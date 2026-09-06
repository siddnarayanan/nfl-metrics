import { Router } from "express";
import { getDefaultSeason, getSeasonAverages, getTeamByAbbreviation, getWeeklyStats } from "../lib/metrics.js";
import { badRequest, notFound } from "../lib/http.js";

export const compareRouter = Router();

compareRouter.get("/compare", async (req, res, next) => {
  try {
    const { teamA, teamB } = req.query;
    if (typeof teamA !== "string" || typeof teamB !== "string") {
      return badRequest(res, "Query params 'teamA' and 'teamB' are required");
    }

    const [teamAInfo, teamBInfo] = await Promise.all([
      getTeamByAbbreviation(teamA),
      getTeamByAbbreviation(teamB),
    ]);
    if (!teamAInfo) return notFound(res, `No team with abbreviation '${teamA}'`);
    if (!teamBInfo) return notFound(res, `No team with abbreviation '${teamB}'`);

    const season = req.query.season ? Number(req.query.season) : await getDefaultSeason();

    const [weeksA, weeksB, averagesA, averagesB] = await Promise.all([
      getWeeklyStats(teamAInfo.id, season),
      getWeeklyStats(teamBInfo.id, season),
      getSeasonAverages(teamAInfo.id, season),
      getSeasonAverages(teamBInfo.id, season),
    ]);

    res.json({
      season,
      teamA: { team: teamAInfo, weeks: weeksA, averages: averagesA },
      teamB: { team: teamBInfo, weeks: weeksB, averages: averagesB },
    });
  } catch (err) {
    next(err);
  }
});
