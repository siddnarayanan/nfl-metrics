"""
Predicts home-team win probability for every game with no final score yet,
using a logistic regression trained on each team's season-to-date efficiency
"form" entering each game. Retrains from scratch every run on all available
labeled games, then upserts predictions for unplayed games into
game_predictions.

Usage:
    python predict.py

Weekly workflow during the season:
    python ingest.py --season 2026   # pull whatever weeks have been played
    python predict.py                # retrain + refresh predictions for remaining games
"""

import os
import warnings
from datetime import datetime

import numpy as np
import pandas as pd
import psycopg2
from dotenv import load_dotenv
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from ingest import upsert

load_dotenv()
warnings.filterwarnings("ignore", message="pandas only supports SQLAlchemy")

METRIC_COLUMNS = [
    "epa_per_play",
    "success_rate",
    "points_per_drive",
    "epa_per_play_allowed",
    "success_rate_allowed",
    "points_per_drive_allowed",
    "st_epa_per_play",
    "st_epa_per_play_allowed",
]
DIFF_COLUMNS = [f"{c}_diff" for c in METRIC_COLUMNS]
MIN_TRAINING_GAMES = 20
# Pseudo-games of weight given to a team's previous-season average when
# computing its current form. Early in a season, with few games played,
# this keeps one fluke result from swinging a team's rating wildly; by
# roughly this many games in, form is mostly this season's own numbers.
SHRINKAGE_GAMES = 4


def load_team_week_stats(conn) -> pd.DataFrame:
    cols = ", ".join(METRIC_COLUMNS)
    return pd.read_sql(f"SELECT team_id, season, week, {cols} FROM team_week_stats", conn)


def load_games(conn) -> pd.DataFrame:
    return pd.read_sql(
        "SELECT id AS game_id, season, week, home_team_id, away_team_id, "
        "home_score, away_score FROM games",
        conn,
    )


def compute_pregame_form(tws: pd.DataFrame, targets: pd.DataFrame) -> pd.DataFrame:
    """For each (team_id, season, week) in `targets`: that team's metrics
    over all weeks it has actually played *before* that week this season (an
    as-of lookup, so it works for weeks with no team_week_stats row yet —
    i.e. upcoming games — and skips byes correctly), shrunk toward its
    previous-season average by SHRINKAGE_GAMES pseudo-games so a handful of
    early-season games don't get taken at full face value. With zero games
    played this season this reduces to the previous season's average; with
    no previous season to shrink toward, it reduces to the plain
    current-season average."""
    tws = tws.sort_values("week").reset_index(drop=True)
    cum = tws.groupby(["team_id", "season"], group_keys=False)[METRIC_COLUMNS].apply(
        lambda g: g.expanding().mean()
    )
    cum = pd.concat([tws[["team_id", "season", "week"]], cum], axis=1)
    cum["n_games"] = tws.groupby(["team_id", "season"]).cumcount() + 1

    targets = targets.sort_values("week").reset_index(drop=True)
    form = pd.merge_asof(
        targets,
        cum,
        on="week",
        by=["team_id", "season"],
        direction="backward",
        allow_exact_matches=False,
    )
    form["n_games"] = form["n_games"].fillna(0)

    prior = tws.groupby(["team_id", "season"])[METRIC_COLUMNS].mean().reset_index()
    prior["season"] += 1  # this average becomes the prior for the following season
    prior = prior.rename(columns={c: f"{c}_prior" for c in METRIC_COLUMNS})
    form = form.merge(prior, on=["team_id", "season"], how="left")

    n = form["n_games"]
    for col in METRIC_COLUMNS:
        current = form[col]
        prior_col = form[f"{col}_prior"].fillna(current)
        form[col] = (n * current.fillna(0) + SHRINKAGE_GAMES * prior_col) / (n + SHRINKAGE_GAMES)
    return form.drop(columns=[f"{c}_prior" for c in METRIC_COLUMNS] + ["n_games"])


def build_features(games: pd.DataFrame, tws: pd.DataFrame) -> pd.DataFrame:
    home_targets = games[["season", "week", "home_team_id"]].rename(
        columns={"home_team_id": "team_id"}
    )
    away_targets = games[["season", "week", "away_team_id"]].rename(
        columns={"away_team_id": "team_id"}
    )
    targets = pd.concat([home_targets, away_targets], ignore_index=True).drop_duplicates()
    form = compute_pregame_form(tws, targets)

    home = form.rename(
        columns={"team_id": "home_team_id", **{c: f"home_{c}" for c in METRIC_COLUMNS}}
    )
    away = form.rename(
        columns={"team_id": "away_team_id", **{c: f"away_{c}" for c in METRIC_COLUMNS}}
    )
    df = games.merge(home, on=["season", "week", "home_team_id"], how="left")
    df = df.merge(away, on=["season", "week", "away_team_id"], how="left")
    for col in METRIC_COLUMNS:
        df[f"{col}_diff"] = df[f"home_{col}"] - df[f"away_{col}"]
    return df


def _labeled_games(features: pd.DataFrame) -> pd.DataFrame:
    labeled = features[features["home_score"].notna() & features["away_score"].notna()].copy()
    labeled = labeled[labeled["home_score"] != labeled["away_score"]]  # drop ties
    labeled = labeled.dropna(subset=DIFF_COLUMNS)
    labeled["label"] = (labeled["home_score"] > labeled["away_score"]).astype(int)
    return labeled.sort_values(["season", "week"])


def _new_model() -> Pipeline:
    return Pipeline([("scaler", StandardScaler()), ("clf", LogisticRegression())])


def train(features: pd.DataFrame) -> tuple[Pipeline, pd.DataFrame]:
    labeled = _labeled_games(features)
    model = _new_model()
    model.fit(labeled[DIFF_COLUMNS], labeled["label"])
    return model, labeled


def backtest(features: pd.DataFrame) -> None:
    labeled = _labeled_games(features)

    correct, total, losses = 0, 0, []
    for (season, week), test_rows in labeled.groupby(["season", "week"]):
        train_rows = labeled[
            (labeled["season"] < season)
            | ((labeled["season"] == season) & (labeled["week"] < week))
        ]
        if len(train_rows) < MIN_TRAINING_GAMES:
            continue

        model = _new_model()
        model.fit(train_rows[DIFF_COLUMNS], train_rows["label"])
        proba = model.predict_proba(test_rows[DIFF_COLUMNS])[:, 1]
        preds = (proba >= 0.5).astype(int)

        correct += int((preds == test_rows["label"].values).sum())
        total += len(test_rows)
        p = np.clip(proba, 1e-15, 1 - 1e-15)
        y = test_rows["label"].values
        losses.extend(-(y * np.log(p) + (1 - y) * np.log(1 - p)))

    if total == 0:
        print("Backtest: not enough historical weeks yet to evaluate.")
        return
    print(f"Backtest: {correct}/{total} = {correct / total:.3f} accuracy, log-loss = {np.mean(losses):.3f}")


def predict_unplayed(model: Pipeline, features: pd.DataFrame) -> pd.DataFrame:
    unplayed = features[features["home_score"].isna()].dropna(subset=DIFF_COLUMNS).copy()
    if unplayed.empty:
        return pd.DataFrame(columns=["game_id", "home_win_probability", "predicted_at"])
    unplayed["home_win_probability"] = model.predict_proba(unplayed[DIFF_COLUMNS])[:, 1]
    unplayed["predicted_at"] = datetime.utcnow()
    return unplayed[["game_id", "home_win_probability", "predicted_at"]]


def run():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        tws = load_team_week_stats(conn)
        games = load_games(conn)
        features = build_features(games, tws)

        n_labeled = int(features["home_score"].notna().sum())
        n_unplayed = int(features["home_score"].isna().sum())
        print(f"Games: {len(features)} total, {n_labeled} played, {n_unplayed} unplayed")

        backtest(features)

        model, labeled = train(features)
        print(f"Trained on {len(labeled)} games.")

        predictions = predict_unplayed(model, features)
        print(f"Generated {len(predictions)} predictions for unplayed games.")

        if not predictions.empty:
            with conn.cursor() as cur:
                upsert(cur, "game_predictions", predictions, ["game_id"])
            conn.commit()
            print("Predictions upserted.")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
