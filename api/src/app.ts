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

const __dirname = dirname(fileURLToPath(import.meta.url));
const openapiDocument = YAML.parse(
  readFileSync(join(__dirname, "..", "openapi.yaml"), "utf-8")
);

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));

app.use("/api", teamsRouter);
app.use("/api", compareRouter);
app.use("/api", leaderboardRouter);
app.use("/api", predictionsRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);
