import { Router } from "express";
import { pool } from "../db.js";
import { getDefaultSeason } from "../lib/metrics.js";

export const predictionsRouter = Router();

async function getNextUpcomingWeek(): Promise<{ season: number; week: number } | null> {
  const { rows } = await pool.query<{ season: number; week: number }>(
    `SELECT season, week FROM games WHERE home_score IS NULL
     ORDER BY season, week LIMIT 1`
  );
  return rows[0] ?? null;
}

const GAME_SELECT = `SELECT g.id AS game_id, g.season, g.week, g.date,
              ht.abbreviation AS home_team, ht.name AS home_team_name, ht.color AS home_team_color,
              ht.color2 AS home_team_color2, ht.logo_url AS home_team_logo_url,
              at.abbreviation AS away_team, at.name AS away_team_name, at.color AS away_team_color,
              at.color2 AS away_team_color2, at.logo_url AS away_team_logo_url,
              g.home_score, g.away_score,
              gp.home_win_probability
       FROM games g
       JOIN teams ht ON ht.id = g.home_team_id
       JOIN teams at ON at.id = g.away_team_id
       LEFT JOIN game_predictions gp ON gp.game_id = g.id`;

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
      `${GAME_SELECT}
       WHERE g.season = $1 AND g.week = $2
       ORDER BY g.date`,
      [season, week]
    );

    res.json({ season, week, games: rows });
  } catch (err) {
    next(err);
  }
});

interface PlayedGameRow {
  home_score: number;
  away_score: number;
  home_win_probability: number;
  week: number;
  [key: string]: unknown;
}

// Every played game this season that had a stored pregame prediction.
// predict.py only writes predictions for unplayed games and leaves them alone
// once the game has a score, so each row here is the model's last forecast
// before kickoff — a genuine out-of-sample prediction, not a retrofit.
predictionsRouter.get("/predictions/results", async (req, res, next) => {
  try {
    const season = req.query.season ? Number(req.query.season) : await getDefaultSeason();

    const { rows } = await pool.query<PlayedGameRow>(
      `${GAME_SELECT}
       WHERE g.season = $1 AND g.home_score IS NOT NULL AND g.away_score IS NOT NULL
         AND gp.home_win_probability IS NOT NULL
       ORDER BY g.week, g.date, g.id`,
      [season]
    );

    let correct = 0;
    let decided = 0;
    let brierSum = 0;
    const weekTotals = new Map<number, { week: number; games: number; correct: number }>();

    const games = rows.map((g) => {
      const predicted_winner = g.home_win_probability >= 0.5 ? "home" : "away";
      const tie = g.home_score === g.away_score;
      const actual_winner = tie ? null : g.home_score > g.away_score ? "home" : "away";
      const isCorrect = actual_winner === null ? null : predicted_winner === actual_winner;

      // Ties have no right answer, so they're shown but left out of the record.
      if (isCorrect !== null) {
        const homeWon = actual_winner === "home" ? 1 : 0;
        decided += 1;
        correct += isCorrect ? 1 : 0;
        brierSum += (g.home_win_probability - homeWon) ** 2;
        const wk = weekTotals.get(g.week) ?? { week: g.week, games: 0, correct: 0 };
        wk.games += 1;
        wk.correct += isCorrect ? 1 : 0;
        weekTotals.set(g.week, wk);
      }

      return { ...g, predicted_winner, actual_winner, correct: isCorrect };
    });

    res.json({
      season,
      summary: {
        games: decided,
        correct,
        accuracy: decided ? correct / decided : null,
        brier_score: decided ? brierSum / decided : null,
      },
      weeks: [...weekTotals.values()],
      games,
    });
  } catch (err) {
    next(err);
  }
});
