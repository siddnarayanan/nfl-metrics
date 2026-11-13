import { Link, useSearchParams } from "react-router-dom";
import {
  usePredictionResults,
  usePredictions,
  type GameResult,
} from "../api/hooks.js";
import type { components } from "../api/client.js";

type GamePrediction = components["schemas"]["GamePrediction"];

const cardClass =
  "rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900";

export function PredictionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "results" ? "results" : "upcoming";

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium ${
      active
        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        <button className={tabClass(view === "upcoming")} onClick={() => setSearchParams({})}>
          Upcoming
        </button>
        <button
          className={tabClass(view === "results")}
          onClick={() => setSearchParams({ view: "results" })}
        >
          Past results
        </button>
      </div>
      {view === "upcoming" ? <UpcomingView /> : <ResultsView />}
    </div>
  );
}

function UpcomingView() {
  const { data, isLoading, isError } = usePredictions();

  if (isLoading) return <p className="text-slate-500 dark:text-slate-400">Loading…</p>;
  if (isError) return <p className="text-red-600 dark:text-red-400">Failed to load predictions.</p>;
  if (!data) return null;

  if (data.season === null || data.games.length === 0) {
    return (
      <div className={`${cardClass} p-6 text-center text-slate-500 dark:text-slate-400`}>
        No upcoming games with predictions yet. Once this season's schedule is ingested and the
        model has run, the next unplayed week will show up here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Season {data.season} — Week {data.week}
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {data.games.map((g) => {
          const played = g.home_score !== null && g.away_score !== null;
          return (
            <div key={g.game_id} className={cardClass}>
              <Matchup game={g} />
              {played ? (
                <p className="mt-2 text-center text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {g.away_score} – {g.home_score}
                </p>
              ) : g.home_win_probability !== null ? (
                <ProbabilityBar game={g} homeProb={g.home_win_probability} />
              ) : (
                <p className="mt-2 text-center text-sm text-slate-400 dark:text-slate-500">
                  Prediction pending
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResultsView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading, isError } = usePredictionResults();

  if (isLoading) return <p className="text-slate-500 dark:text-slate-400">Loading…</p>;
  if (isError) return <p className="text-red-600 dark:text-red-400">Failed to load results.</p>;
  if (!data) return null;

  if (data.games.length === 0) {
    return (
      <div className={`${cardClass} p-6 text-center text-slate-500 dark:text-slate-400`}>
        No graded predictions for {data.season} yet. Once a game the model predicted has been
        played, it will show up here.
      </div>
    );
  }

  const weeks = [...new Set(data.games.map((g) => g.week))];
  const requestedWeek = Number(searchParams.get("week"));
  const selectedWeek = weeks.includes(requestedWeek) ? requestedWeek : weeks[weeks.length - 1];
  const weekRecords = new Map(data.weeks.map((w) => [w.week, w]));
  const selectedGames = data.games.filter((g) => g.week === selectedWeek);
  const { summary } = data;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Season {data.season} — Model record
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            label="Correct picks"
            value={`${summary.correct}–${summary.games - summary.correct}`}
            detail={`${summary.games} games graded`}
          />
          <StatTile
            label="Accuracy"
            value={summary.accuracy !== null ? `${(summary.accuracy * 100).toFixed(1)}%` : "—"}
            detail="Picking the side the model gave ≥ 50%"
          />
          <StatTile
            label="Brier score"
            value={summary.brier_score !== null ? summary.brier_score.toFixed(3) : "—"}
            detail="Lower is better · 0.250 = coin flip"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {weeks.map((week) => {
            const rec = weekRecords.get(week);
            const active = week === selectedWeek;
            return (
              <button
                key={week}
                onClick={() => setSearchParams({ view: "results", week: String(week) })}
                className={`rounded-md border px-2.5 py-1 text-left text-xs ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <span className="block font-medium">Week {week}</span>
                <span className={active ? "opacity-80" : "text-slate-500 dark:text-slate-400"}>
                  {rec ? `${rec.correct}/${rec.games}` : "—"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {selectedGames.map((g) => (
            <ResultCard key={g.game_id} game={g} />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className={cardClass}>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function ResultCard({ game: g }: { game: GameResult }) {
  const homeProb = g.home_win_probability!;
  const pickedTeam = g.predicted_winner === "home" ? g.home_team : g.away_team;
  const pickedPct = Math.round((g.predicted_winner === "home" ? homeProb : 1 - homeProb) * 100);

  const badge =
    g.correct === null
      ? {
          text: "Tie",
          className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
        }
      : g.correct
        ? {
            text: "✓ Correct",
            className:
              "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
          }
        : {
            text: "✗ Missed",
            className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
          };

  const scoreClass = (side: "home" | "away") =>
    g.actual_winner === side
      ? "text-slate-900 dark:text-slate-100"
      : "text-slate-400 dark:text-slate-500";

  return (
    <div className={cardClass}>
      <Matchup game={g} />
      <p className="mt-2 text-center text-2xl font-bold">
        <span className={scoreClass("away")}>{g.away_score}</span>
        <span className="text-slate-400 dark:text-slate-500"> – </span>
        <span className={scoreClass("home")}>{g.home_score}</span>
      </p>
      <ProbabilityBar game={g} homeProb={homeProb} />
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400">
          Model picked {pickedTeam} ({pickedPct}%)
        </span>
        <span className={`rounded-full px-2 py-0.5 font-medium ${badge.className}`}>
          {badge.text}
        </span>
      </div>
    </div>
  );
}

function Matchup({ game: g }: { game: GamePrediction }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <TeamLink abbreviation={g.away_team} name={g.away_team_name} logoUrl={g.away_team_logo_url} />
      <span className="text-slate-400 dark:text-slate-500">@</span>
      <TeamLink abbreviation={g.home_team} name={g.home_team_name} logoUrl={g.home_team_logo_url} />
    </div>
  );
}

function TeamLink({
  abbreviation,
  name,
  logoUrl,
}: {
  abbreviation: string;
  name: string;
  logoUrl?: string | null;
}) {
  return (
    <Link
      to={`/teams/${abbreviation}`}
      className="flex items-center gap-1.5 font-medium text-slate-900 hover:underline dark:text-slate-100"
    >
      {logoUrl && <img src={logoUrl} alt="" className="h-5 w-5 object-contain" />}
      {name}
    </Link>
  );
}

function ProbabilityBar({ game: g, homeProb }: { game: GamePrediction; homeProb: number }) {
  const homePct = Math.round(homeProb * 100);
  const awayPct = 100 - homePct;
  return (
    <div className="mt-3">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full box-border"
          style={{
            width: `${awayPct}%`,
            backgroundColor: g.away_team_color ?? "#64748b",
            border: `1.5px solid ${g.away_team_color2 ?? g.away_team_color ?? "#64748b"}`,
          }}
        />
        <div
          className="h-full box-border"
          style={{
            width: `${homePct}%`,
            backgroundColor: g.home_team_color ?? "#2563eb",
            border: `1.5px solid ${g.home_team_color2 ?? g.home_team_color ?? "#2563eb"}`,
          }}
        />
      </div>
      <p className="mt-1 flex justify-between text-sm text-slate-600 dark:text-slate-400">
        <span>
          {g.away_team} {awayPct}%
        </span>
        <span>
          {g.home_team} {homePct}%
        </span>
      </p>
    </div>
  );
}
