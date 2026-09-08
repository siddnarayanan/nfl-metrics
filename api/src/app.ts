import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import YAML from "yaml";
import { teamsRouter } from "./routes/teams.js";
import { compareRouter } from "./routes/compare.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { predictionsRouter } from "./routes/predictions.js";
import { playersRouter } from "./routes/players.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const openapiDocument = YAML.parse(
  readFileSync(join(__dirname, "..", "openapi.yaml"), "utf-8")
);

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// No reason for a crawler to index raw JSON API responses. The catch-all
// Vercel rewrite (see api/vercel.json) means a real static robots.txt file
// wouldn't be reachable anyway, so this is simpler than a rewrite exception.
app.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send("User-agent: *\nDisallow: /\n");
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));

// Data only changes when the weekly ingestion job runs, so these GET
// responses are safe to cache — this lets Vercel's edge network serve
// repeat identical requests (bot or human) without invoking the function.
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  next();
});

app.use("/api", teamsRouter);
app.use("/api", compareRouter);
app.use("/api", leaderboardRouter);
app.use("/api", predictionsRouter);
app.use("/api", playersRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);
