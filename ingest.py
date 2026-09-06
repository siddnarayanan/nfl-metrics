"""
Pulls one or more NFL seasons from nflverse, computes team-week efficiency
metrics (EPA/play, success rate, points/drive), and upserts everything into
Postgres.

Usage:
    python ingest.py --season 2025
    python ingest.py --season 2025 2026     # once 2026 has games played

If DATABASE_URL is not set, runs in dry-run mode: writes each table to a CSV
under ./output/ instead of touching a database, so the pipeline can be
verified before Postgres is provisioned.
"""

import argparse
import os

import nfl_data_py as nfl
import pandas as pd
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

STATS_PLAYER_WEEK_URL = (
    "https://github.com/nflverse/nflverse-data/releases/download/"
    "stats_player/stats_player_week_{season}.parquet"
)

# fixed_drive_result -> points, per nflverse pbp drive outcome labels.
# Approximation: doesn't credit points off a defensive/special-teams TD scored
# against the opponent's drive, and ignores missed extra points/2pt tries.
DRIVE_RESULT_POINTS = {
    "Touchdown": 7,
    "Field goal": 3,
}


def fetch_player_stats_raw(season: int) -> pd.DataFrame:
    # nfl_data_py's import_weekly_data() points at a dead URL (nflverse
    # renamed the release from player_stats -> stats_player); read directly.
    return pd.read_parquet(STATS_PLAYER_WEEK_URL.format(season=season))


def build_teams(seasons: list[int]) -> pd.DataFrame:
    desc = nfl.import_team_desc()
    sched = nfl.import_schedules(seasons)
    active = set(sched["home_team"]) | set(sched["away_team"])
    teams = desc[desc["team_abbr"].isin(active)][
        ["team_abbr", "team_name", "team_conf", "team_division"]
    ].rename(
        columns={
            "team_abbr": "abbreviation",
            "team_name": "name",
            "team_conf": "conference",
            "team_division": "division",
        }
    )
    return teams.sort_values("abbreviation").reset_index(drop=True)


def build_games(seasons: list[int]) -> pd.DataFrame:
    sched = nfl.import_schedules(seasons)
    games = sched[
        [
            "game_id",
            "season",
            "week",
            "game_type",
            "home_team",
            "away_team",
            "home_score",
            "away_score",
            "gameday",
        ]
    ].rename(
        columns={
            "game_id": "id",
            "game_type": "season_type",
            "home_team": "home_team_abbr",
            "away_team": "away_team_abbr",
            "gameday": "date",
        }
    )
    return games


def build_team_week_stats(seasons: list[int]) -> pd.DataFrame:
    pbp = nfl.import_pbp_data(seasons, downcast=True)

    offense = (
        pbp[pbp["posteam"].notna() & pbp["epa"].notna()]
        .groupby(["season", "posteam", "week"])
        .agg(epa_per_play=("epa", "mean"), success_rate=("success", "mean"))
        .reset_index()
    )

    drives = pbp[pbp["posteam"].notna() & pbp["drive"].notna()].drop_duplicates(
        subset=["game_id", "posteam", "drive"]
    )
    drives = drives.assign(
        drive_points=drives["fixed_drive_result"].map(DRIVE_RESULT_POINTS).fillna(0)
    )
    points_per_drive = (
        drives.groupby(["season", "posteam", "week"])
        .agg(points=("drive_points", "sum"), drive_count=("drive", "count"))
        .reset_index()
    )
    points_per_drive["points_per_drive"] = (
        points_per_drive["points"] / points_per_drive["drive_count"]
    )

    merged = offense.merge(
        points_per_drive[["season", "posteam", "week", "points_per_drive"]],
        on=["season", "posteam", "week"],
        how="left",
    ).rename(columns={"posteam": "team_abbr"})
    return merged


def build_player_stats(seasons: list[int]) -> pd.DataFrame:
    frames = [fetch_player_stats_raw(s) for s in seasons]
    df = pd.concat(frames, ignore_index=True)
    # nflverse includes one team-level penalty-aggregate row per team per
    # game (player_id/name null, only penalties/penalty_yards populated) —
    # not an actual player, so it doesn't belong in a player_stats table.
    df = df[df["player_id"].notna()]
    return df.rename(columns={"team": "team_abbr", "opponent_team": "opponent_team_abbr"})


def team_lookup(cur) -> dict:
    cur.execute("SELECT abbreviation, id FROM teams")
    return dict(cur.fetchall())


def upsert(cur, table: str, df: pd.DataFrame, conflict_cols: list[str]):
    if df.empty:
        return
    cols = list(df.columns)
    update_cols = [c for c in cols if c not in conflict_cols]
    set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
    query = (
        f"INSERT INTO {table} ({', '.join(cols)}) VALUES %s "
        f"ON CONFLICT ({', '.join(conflict_cols)}) DO UPDATE SET {set_clause}"
    )
    values = [tuple(row) for row in df.itertuples(index=False, name=None)]
    psycopg2.extras.execute_values(cur, query, values, page_size=1000)


def run(seasons: list[int]):
    print(f"Fetching data for seasons: {seasons}")
    teams = build_teams(seasons)
    games = build_games(seasons)
    team_week = build_team_week_stats(seasons)
    player_stats = build_player_stats(seasons)

    print(f"teams: {len(teams)} rows")
    print(f"games: {len(games)} rows")
    print(f"team_week_stats: {len(team_week)} rows")
    print(f"player_stats: {len(player_stats)} rows")

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        out_dir = "output"
        os.makedirs(out_dir, exist_ok=True)
        teams.to_csv(f"{out_dir}/teams.csv", index=False)
        games.to_csv(f"{out_dir}/games.csv", index=False)
        team_week.to_csv(f"{out_dir}/team_week_stats.csv", index=False)
        player_stats.to_csv(f"{out_dir}/player_stats.csv", index=False)
        print(
            f"\nDATABASE_URL not set — dry run only. Wrote CSVs to ./{out_dir}/ "
            "for inspection. Set DATABASE_URL in .env to write to Postgres."
        )
        return

    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor() as cur:
            upsert(cur, "teams", teams, ["abbreviation"])
            conn.commit()

            team_id = team_lookup(cur)

            games_db = games.copy()
            games_db["home_team_id"] = games_db["home_team_abbr"].map(team_id)
            games_db["away_team_id"] = games_db["away_team_abbr"].map(team_id)
            games_db = games_db.drop(columns=["home_team_abbr", "away_team_abbr"])
            upsert(cur, "games", games_db, ["id"])
            conn.commit()

            team_week_db = team_week.copy()
            team_week_db["team_id"] = team_week_db["team_abbr"].map(team_id)
            team_week_db = team_week_db.drop(columns=["team_abbr"])
            upsert(cur, "team_week_stats", team_week_db, ["team_id", "season", "week"])
            conn.commit()

            player_stats_db = player_stats.copy()
            player_stats_db["team_id"] = player_stats_db["team_abbr"].map(team_id)
            player_stats_db["opponent_team_id"] = player_stats_db[
                "opponent_team_abbr"
            ].map(team_id)
            player_stats_db = player_stats_db.drop(
                columns=["team_abbr", "opponent_team_abbr"]
            )
            upsert(cur, "player_stats", player_stats_db, ["player_id", "game_id"])
            conn.commit()

        print("\nIngestion complete.")
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--season", type=int, nargs="+", default=[2025])
    args = parser.parse_args()
    run(args.season)
