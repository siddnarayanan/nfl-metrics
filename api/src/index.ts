import "dotenv/config";
import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import { teamsRouter } from "./routes/teams.js";
import { compareRouter } from "./routes/compare.js";
import { leaderboardRouter } from "./routes/leaderboard.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api", teamsRouter);
app.use("/api", compareRouter);
app.use("/api", leaderboardRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`API listening on port ${port}`));
