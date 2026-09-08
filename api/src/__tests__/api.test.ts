import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { pool } from "../db.js";

// Fixtures live under a clearly-fake season so they can never collide with
// real ingested data, even if this ever ran against a non-throwaway DB.
const FIXTURE_SEASON = 2099;
const FIXTURE_ABBREVIATIONS = ["ZZA", "ZZB", "ZZC"];
const FIXTURE_GAME_ID = "2099_TEST_ZZA_ZZB";

async function cleanupFixtures() {
  await pool.query("DELETE FROM game_predictions WHERE game_id = $1", [FIXTURE_GAME_ID]);
  await pool.query("DELETE FROM games WHERE id = $1", [FIXTURE_GAME_ID]);
  await pool.query("DELETE FROM team_week_stats WHERE season = $1", [FIXTURE_SEASON]);
  await pool.query("DELETE FROM player_stats WHERE season = $1", [FIXTURE_SEASON]);
  await pool.query("DELETE FROM teams WHERE abbreviation = ANY($1)", [FIXTURE_ABBREVIATIONS]);
}

beforeAll(async () => {
  await pool.query(readFileSync(new URL("../../../schema.sql", import.meta.url), "utf-8"));
  await cleanupFixtures();

  const teamIds: Record<string, number> = {};
  for (const [i, abbr] of FIXTURE_ABBREVIATIONS.entries()) {
    const { rows } = await pool.query<{ id: number }>(
      "INSERT INTO teams (name, abbreviation, conference, division) VALUES ($1, $2, 'NFC', 'NFC Test') RETURNING id",
      [`Test Team ${abbr}`, abbr]
    );
    teamIds[abbr] = rows[0].id;
    void i;
  }

  // epa_per_play averages: ZZA=0.4, ZZB=0.3, ZZC=-0.05
  const weeks: [string, number, number][] = [
    ["ZZA", 1, 0.5],
    ["ZZA", 2, 0.3],
    ["ZZB", 1, 0.2],
    ["ZZB", 2, 0.4],
    ["ZZC", 1, -0.1],
    ["ZZC", 2, 0.0],
  ];
  for (const [abbr, week, epa] of weeks) {
    await pool.query(
      `INSERT INTO team_week_stats (team_id, season, week, epa_per_play, success_rate, points_per_drive)
       VALUES ($1, $2, $3, $4, 0.45, 2.0)`,
      [teamIds[abbr], FIXTURE_SEASON, week, epa]
    );
  }

  await pool.query(
    `INSERT INTO games (id, season, week, season_type, home_team_id, away_team_id, home_score, away_score, date)
     VALUES ($1, $2, 1, 'REG', $3, $4, NULL, NULL, '2099-09-01')`,
    [FIXTURE_GAME_ID, FIXTURE_SEASON, teamIds["ZZA"], teamIds["ZZB"]]
  );
  await pool.query(
    "INSERT INTO game_predictions (game_id, home_win_probability) VALUES ($1, 0.65)",
    [FIXTURE_GAME_ID]
  );

  // QB: 3 weeks, 180 attempts total (clears the 150-attempt cutoff).
  // epa_per_attempt = 13/180, yards_per_attempt = 1170/180, td_rate = 6/180.
  const qbWeeks: [number, number, number, number, number][] = [
    // week, attempts, passing_epa, passing_yards, passing_tds
    [1, 60, 10, 400, 3],
    [2, 60, -5, 350, 1],
    [3, 60, 8, 420, 2],
  ];
  for (const [week, attempts, epa, yards, tds] of qbWeeks) {
    await pool.query(
      `INSERT INTO player_stats (player_id, player_name, position, team_id, season, week, season_type,
                                  attempts, passing_epa, passing_yards, passing_tds)
       VALUES ('ZZQB1', 'Test Quarterback', 'QB', $1, $2, $3, 'REG', $4, $5, $6, $7)`,
      [teamIds["ZZA"], FIXTURE_SEASON, week, attempts, epa, yards, tds]
    );
  }

  // EDGE: 8 games (clears the games>=8 cutoff), 1 sack + 2 QB hits + 1 TFL
  // per game -> sacks_per_game=1, qb_hits_per_game=2, tfl_per_game=1.
  for (let week = 1; week <= 8; week++) {
    await pool.query(
      `INSERT INTO player_stats (player_id, player_name, position, team_id, season, week, season_type,
                                  def_sacks, def_qb_hits, def_tackles_for_loss)
       VALUES ('ZZEDGE1', 'Test Edge Rusher', 'DE', $1, $2, $3, 'REG', 1, 2, 1)`,
      [teamIds["ZZB"], FIXTURE_SEASON, week]
    );
  }
});

afterAll(async () => {
  await cleanupFixtures();
  await pool.end();
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("GET /api/teams", () => {
  it("includes the fixture teams, sorted by abbreviation", async () => {
    const res = await request(app).get("/api/teams");
    expect(res.status).toBe(200);
    const abbrs = res.body.map((t: { abbreviation: string }) => t.abbreviation);
    const fixtureAbbrs = abbrs.filter((a: string) => FIXTURE_ABBREVIATIONS.includes(a));
    expect(fixtureAbbrs).toEqual(["ZZA", "ZZB", "ZZC"]);
  });
});

describe("GET /api/teams/:abbreviation/stats", () => {
  it("returns weekly stats for a known team", async () => {
    const res = await request(app).get(`/api/teams/ZZA/stats?season=${FIXTURE_SEASON}`);
    expect(res.status).toBe(200);
    expect(res.body.team.abbreviation).toBe("ZZA");
    expect(res.body.weeks).toHaveLength(2);
    expect(res.body.weeks[0].epa_per_play).toBeCloseTo(0.5);
  });

  it("404s for an unknown team", async () => {
    const res = await request(app).get("/api/teams/ZZZ/stats");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/ZZZ/);
  });
});

describe("GET /api/compare", () => {
  it("returns both teams' weekly series and averages", async () => {
    const res = await request(app).get(
      `/api/compare?teamA=ZZA&teamB=ZZB&season=${FIXTURE_SEASON}`
    );
    expect(res.status).toBe(200);
    expect(res.body.teamA.team.abbreviation).toBe("ZZA");
    expect(res.body.teamB.team.abbreviation).toBe("ZZB");
    expect(Number(res.body.teamA.averages.epa_per_play)).toBeCloseTo(0.4);
    expect(Number(res.body.teamB.averages.epa_per_play)).toBeCloseTo(0.3);
  });

  it("400s when a team param is missing", async () => {
    const res = await request(app).get("/api/compare?teamA=ZZA");
    expect(res.status).toBe(400);
  });

  it("404s when a team is unknown", async () => {
    const res = await request(app).get("/api/compare?teamA=ZZA&teamB=ZZZ");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/ZZZ/);
  });
});

describe("GET /api/leaderboard", () => {
  it("ranks fixture teams by epa_per_play descending", async () => {
    const res = await request(app).get(
      `/api/leaderboard?metric=epa_per_play&season=${FIXTURE_SEASON}&limit=32`
    );
    expect(res.status).toBe(200);
    const fixtureRows = res.body.filter((r: { abbreviation: string }) =>
      FIXTURE_ABBREVIATIONS.includes(r.abbreviation)
    );
    expect(fixtureRows.map((r: { abbreviation: string }) => r.abbreviation)).toEqual([
      "ZZA",
      "ZZB",
      "ZZC",
    ]);
  });

  it("400s for an invalid metric (SQL-injection guard)", async () => {
    const res = await request(app).get("/api/leaderboard?metric=not_a_column; DROP TABLE teams;");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/predictions", () => {
  it("returns the fixture game with its prediction for an explicit season/week", async () => {
    const res = await request(app).get(`/api/predictions?season=${FIXTURE_SEASON}&week=1`);
    expect(res.status).toBe(200);
    expect(res.body.season).toBe(FIXTURE_SEASON);
    expect(res.body.week).toBe(1);
    const game = res.body.games.find((g: { game_id: string }) => g.game_id === FIXTURE_GAME_ID);
    expect(game).toBeTruthy();
    expect(game.home_team).toBe("ZZA");
    expect(game.away_team).toBe("ZZB");
    expect(Number(game.home_win_probability)).toBeCloseTo(0.65);
    expect(game.home_score).toBeNull();
  });

  it("returns an empty games list for a season/week with no games", async () => {
    const res = await request(app).get(`/api/predictions?season=${FIXTURE_SEASON}&week=99`);
    expect(res.status).toBe(200);
    expect(res.body.games).toEqual([]);
  });
});

describe("GET /api/players", () => {
  it("computes season-long QB rates as SUM/SUM, not an average of weekly totals", async () => {
    const res = await request(app).get(
      `/api/players?position=QB&metric=epa_per_attempt&season=${FIXTURE_SEASON}`
    );
    expect(res.status).toBe(200);
    expect(res.body.metrics).toEqual(
      expect.arrayContaining(["epa_per_attempt", "yards_per_attempt", "td_rate"])
    );
    const qb = res.body.players.find((p: { player_id: string }) => p.player_id === "ZZQB1");
    expect(qb).toBeTruthy();
    expect(qb.volume).toBe(180);
    expect(qb.team_abbreviation).toBe("ZZA");
    expect(qb.values.epa_per_attempt).toBeCloseTo(13 / 180);
    expect(qb.values.yards_per_attempt).toBeCloseTo(1170 / 180);
    expect(qb.values.td_rate).toBeCloseTo(6 / 180);
  });

  it("computes defensive per-game rates and applies the games-played cutoff", async () => {
    const res = await request(app).get(
      `/api/players?position=EDGE&metric=sacks_per_game&season=${FIXTURE_SEASON}`
    );
    expect(res.status).toBe(200);
    const edge = res.body.players.find((p: { player_id: string }) => p.player_id === "ZZEDGE1");
    expect(edge).toBeTruthy();
    expect(edge.volume).toBe(8);
    expect(edge.values.sacks_per_game).toBeCloseTo(1);
    expect(edge.values.qb_hits_per_game).toBeCloseTo(2);
    expect(edge.values.tfl_per_game).toBeCloseTo(1);
  });

  it("400s for an invalid position", async () => {
    const res = await request(app).get("/api/players?position=XYZ");
    expect(res.status).toBe(400);
  });

  it("400s for a metric not defined on the given position", async () => {
    const res = await request(app).get("/api/players?position=QB&metric=sacks_per_game");
    expect(res.status).toBe(400);
  });
});
