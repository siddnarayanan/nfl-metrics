import { pool } from "../db.js";
import { METRIC_COLUMNS, MetricColumn, Team, TeamWeekMetrics } from "../types.js";

export function isMetricColumn(value: string): value is MetricColumn {
  return (METRIC_COLUMNS as readonly string[]).includes(value);
}

export async function getTeamByAbbreviation(abbreviation: string): Promise<Team | null> {
  const { rows } = await pool.query<Team>(
    "SELECT id, name, abbreviation, conference, division, logo_url, color, color2 FROM teams WHERE abbreviation = $1",
    [abbreviation.toUpperCase()]
  );
  return rows[0] ?? null;
}

export async function getDefaultSeason(): Promise<number> {
  const { rows } = await pool.query<{ max: number }>(
    "SELECT MAX(season) AS max FROM team_week_stats"
  );
  return rows[0].max;
}

export async function getWeeklyStats(teamId: number, season: number): Promise<TeamWeekMetrics[]> {
  const { rows } = await pool.query<TeamWeekMetrics>(
    `SELECT week, epa_per_play, success_rate, points_per_drive,
            epa_per_play_allowed, success_rate_allowed, points_per_drive_allowed,
            st_epa_per_play, st_epa_per_play_allowed
     FROM team_week_stats
     WHERE team_id = $1 AND season = $2
     ORDER BY week`,
    [teamId, season]
  );
  return rows;
}

export async function getSeasonAverages(
  teamId: number,
  season: number
): Promise<Record<MetricColumn, number | null>> {
  const selects = METRIC_COLUMNS.map((c) => `AVG(${c}) AS ${c}`).join(", ");
  const { rows } = await pool.query(
    `SELECT ${selects} FROM team_week_stats WHERE team_id = $1 AND season = $2`,
    [teamId, season]
  );
  return rows[0];
}
