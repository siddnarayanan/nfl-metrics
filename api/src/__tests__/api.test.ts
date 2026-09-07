import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { pool } from "../db.js";

// Fixtures live under a clearly-fake season so they can never collide with
// real ingested data, even if this ever ran against a non-throwaway DB.
const FIXTURE_SEASON = 2099;
const FIXTURE_ABBREVIATIONS = ["ZZA", "ZZB", "ZZC"];

async function cleanupFixtures() {
  await pool.query("DELETE FROM team_week_stats WHERE season = $1", [FIXTURE_SEASON]);
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
