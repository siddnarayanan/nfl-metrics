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


def load_team_week_stats(conn) -> pd.DataFrame:
    cols = ", ".join(METRIC_COLUMNS)
    return pd.read_sql(f"SELECT team_id, season, week, {cols} FROM team_week_stats", conn)


def load_games(conn) -> pd.DataFrame:
    return pd.read_sql(
        "SELECT id AS game_id, season, week, home_team_id, away_team_id, "
        "home_score, away_score FROM games",
        conn,
    )


def compute_pregame_form(tws: pd.DataFrame) -> pd.DataFrame:
    """Per team-week: average of that team's metrics over all *prior* weeks
    this season, falling back to the previous season's full-season average
    for week-1-of-a-season rows with no current-season history yet."""
    tws = tws.sort_values(["team_id", "season", "week"]).reset_index(drop=True)

    prior = (
        tws.groupby(["team_id", "season"], group_keys=False)[METRIC_COLUMNS]
        .apply(lambda g: g.expanding().mean().shift(1))
        .reset_index(drop=True)
    )
    form = pd.concat([tws[["team_id", "season", "week"]], prior], axis=1)

    season_avg = tws.groupby(["team_id", "season"])[METRIC_COLUMNS].mean().reset_index()
    season_avg["season"] += 1  # this average becomes the "prior" for the following season
    season_avg = season_avg.rename(columns={c: f"{c}_fallback" for c in METRIC_COLUMNS})

    form = form.merge(season_avg, on=["team_id", "season"], how="left")
    for col in METRIC_COLUMNS:
        form[col] = form[col].fillna(form[f"{col}_fallback"])
    return form.drop(columns=[f"{c}_fallback" for c in METRIC_COLUMNS])


def build_features(games: pd.DataFrame, form: pd.DataFrame) -> pd.DataFrame:
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
        form = compute_pregame_form(tws)
        features = build_features(games, form)

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
