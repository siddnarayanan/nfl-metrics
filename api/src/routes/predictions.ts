import { Router } from "express";
import { pool } from "../db.js";

export const predictionsRouter = Router();

async function getNextUpcomingWeek(): Promise<{ season: number; week: number } | null> {
  const { rows } = await pool.query<{ season: number; week: number }>(
    `SELECT season, week FROM games WHERE home_score IS NULL
     ORDER BY season, week LIMIT 1`
  );
  return rows[0] ?? null;
}

predictionsRouter.get("/predictions", async (req, res, next) => {
  try {
    let season = req.query.season ? Number(req.query.season) : undefined;
    let week = req.query.week ? Number(req.query.week) : undefined;

    if (season === undefined || week === undefined) {
      const upcoming = await getNextUpcomingWeek();
      if (!upcoming) {
        return res.json({ season: null, week: null, games: [] });
      }
      season ??= upcoming.season;
      week ??= upcoming.week;
    }

    const { rows } = await pool.query(
      `SELECT g.id AS game_id, g.season, g.week, g.date,
              ht.abbreviation AS home_team, ht.name AS home_team_name,
              at.abbreviation AS away_team, at.name AS away_team_name,
              g.home_score, g.away_score,
              gp.home_win_probability
       FROM games g
       JOIN teams ht ON ht.id = g.home_team_id
       JOIN teams at ON at.id = g.away_team_id
       LEFT JOIN game_predictions gp ON gp.game_id = g.id
       WHERE g.season = $1 AND g.week = $2
       ORDER BY g.date`,
      [season, week]
    );

    res.json({ season, week, games: rows });
  } catch (err) {
    next(err);
  }
});
