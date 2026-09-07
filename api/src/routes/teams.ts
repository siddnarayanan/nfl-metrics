import { Router } from "express";
import { pool } from "../db.js";
import { getDefaultSeason, getTeamByAbbreviation, getWeeklyStats } from "../lib/metrics.js";
import { notFound } from "../lib/http.js";
import { Team } from "../types.js";

export const teamsRouter = Router();

teamsRouter.get("/teams", async (_req, res, next) => {
  try {
    const { rows } = await pool.query<Team>(
      "SELECT id, name, abbreviation, conference, division, logo_url, color, color2 FROM teams ORDER BY abbreviation"
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

teamsRouter.get("/teams/:abbreviation/stats", async (req, res, next) => {
  try {
    const team = await getTeamByAbbreviation(req.params.abbreviation);
    if (!team) {
      return notFound(res, `No team with abbreviation '${req.params.abbreviation}'`);
    }

    const season = req.query.season ? Number(req.query.season) : await getDefaultSeason();
    const weeks = await getWeeklyStats(team.id, season);

    res.json({ team, season, weeks });
  } catch (err) {
    next(err);
  }
});
