import { Router } from "express";
import { pool } from "../db.js";
import { getDefaultSeason, isMetricColumn } from "../lib/metrics.js";
import { badRequest } from "../lib/http.js";
import { METRIC_COLUMNS } from "../types.js";

export const leaderboardRouter = Router();

leaderboardRouter.get("/leaderboard", async (req, res, next) => {
  try {
    const metric = typeof req.query.metric === "string" ? req.query.metric : "epa_per_play";
    if (!isMetricColumn(metric)) {
      return badRequest(res, `'metric' must be one of: ${METRIC_COLUMNS.join(", ")}`);
    }

    const order = req.query.order === "asc" ? "ASC" : "DESC";
    const limit = Math.min(Number(req.query.limit) || 10, 32);
    const season = req.query.season ? Number(req.query.season) : await getDefaultSeason();

    // metric is validated against the METRIC_COLUMNS whitelist above, so it's
    // safe to interpolate directly — never do this with unvalidated input.
    const { rows } = await pool.query(
      `SELECT t.abbreviation, t.name, AVG(tw.${metric}) AS value
       FROM team_week_stats tw
       JOIN teams t ON t.id = tw.team_id
       WHERE tw.season = $1
       GROUP BY t.id
       ORDER BY value ${order}
       LIMIT $2`,
      [season, limit]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});
