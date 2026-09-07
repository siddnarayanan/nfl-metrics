import { Router } from "express";
import { pool } from "../db.js";
import { getDefaultSeason } from "../lib/metrics.js";
import { badRequest } from "../lib/http.js";
import {
  isPlayerMetric,
  isPositionGroup,
  MIN_VOLUME,
  PLAYER_METRICS,
  POSITION_CODES,
  POSITION_GROUPS,
  type PositionGroup,
} from "../lib/playerMetrics.js";

export const playersRouter = Router();

playersRouter.get("/players", async (req, res, next) => {
  try {
    const position = typeof req.query.position === "string" ? req.query.position : "";
    if (!isPositionGroup(position)) {
      return badRequest(res, `'position' must be one of: ${POSITION_GROUPS.join(", ")}`);
    }

    const metricDefs = PLAYER_METRICS[position];
    const metricKeys = Object.keys(metricDefs);

    const sortMetric = typeof req.query.metric === "string" ? req.query.metric : metricKeys[0];
    if (!isPlayerMetric(position, sortMetric)) {
      return badRequest(
        res,
        `'metric' for position '${position}' must be one of: ${metricKeys.join(", ")}`
      );
    }

    const order = req.query.order === "asc" ? "ASC" : "DESC";
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const season = req.query.season ? Number(req.query.season) : await getDefaultSeason();
    const volume = MIN_VOLUME[position];

    // Every raw SUM (or COUNT via 'games') needed by any metric/threshold
    // for this position, deduped by expression. player_stats columns/exprs
    // here always come from playerMetrics.ts, never request input.
    const rawAliases = new Map<string, string>();
    function rawAlias(expr: string): string {
      if (expr === "games") return "games";
      if (!rawAliases.has(expr)) rawAliases.set(expr, `raw_${rawAliases.size}`);
      return rawAliases.get(expr)!;
    }
    for (const def of Object.values(metricDefs)) {
      rawAlias(def.numerator);
      if (def.denominator !== "games") rawAlias(def.denominator);
    }
    if (volume.column !== "games") rawAlias(volume.column);

    // nflverse leaves a handful of *_epa values as NaN for degenerate
    // 0-opportunity weeks (e.g. a QB's kneel-only appearance). NaN isn't
    // NULL — SUM() propagates it instead of skipping it, silently poisoning
    // a player's entire season total. NULLIF converts it to a real NULL
    // first, which SUM correctly ignores.
    const cteSelects = [...rawAliases.entries()].map(
      ([expr, alias]) => `SUM(NULLIF(${expr}, 'NaN'::double precision)) AS ${alias}`
    );

    const outerSelects = metricKeys.map((key) => {
      const def = metricDefs[key];
      const numAlias = rawAlias(def.numerator);
      const denExpr = def.denominator === "games" ? "games" : rawAlias(def.denominator);
      // Cast to numeric — every raw column here is an integer type, and
      // Postgres does truncating integer division for int/int otherwise.
      return `${numAlias}::numeric / NULLIF(${denExpr}, 0) AS ${key}`;
    });

    const volumeSelectAlias = volume.column === "games" ? "games" : rawAlias(volume.column);

    const query = `
      WITH agg AS (
        SELECT
          player_id,
          (array_agg(player_display_name ORDER BY week DESC))[1] AS name,
          (array_agg(team_id ORDER BY week DESC))[1] AS team_id,
          (array_agg(headshot_url ORDER BY week DESC) FILTER (WHERE headshot_url IS NOT NULL))[1] AS headshot_url,
          COUNT(*) AS games,
          ${cteSelects.join(", ")}
        FROM player_stats
        WHERE season = $1 AND position = ANY($2)
        GROUP BY player_id
      )
      SELECT
        agg.player_id, agg.name, agg.headshot_url,
        ${volumeSelectAlias} AS volume,
        t.abbreviation AS team_abbreviation, t.color AS team_color, t.logo_url AS team_logo_url,
        ${outerSelects.join(", ")}
      FROM agg
      JOIN teams t ON t.id = agg.team_id
      WHERE ${volumeSelectAlias} >= $3
      ORDER BY ${sortMetric} ${order} NULLS LAST
      LIMIT $4
    `;

    const { rows } = await pool.query(query, [
      season,
      POSITION_CODES[position as PositionGroup],
      volume.min,
      limit,
    ]);

    const players = rows.map((row) => {
      const { player_id, name, headshot_url, volume: playerVolume, team_abbreviation, team_color, team_logo_url, ...rest } = row;
      return {
        player_id,
        name,
        headshot_url,
        volume: Number(playerVolume),
        team_abbreviation,
        team_color,
        team_logo_url,
        values: Object.fromEntries(
          metricKeys.map((key) => [key, rest[key] === null ? null : Number(rest[key])])
        ),
      };
    });

    res.json({ position, season, metrics: metricKeys, players });
  } catch (err) {
    next(err);
  }
});
