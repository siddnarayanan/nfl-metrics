import { Link } from "react-router-dom";
import { usePredictions } from "../api/hooks.js";

export function PredictionsPage() {
  const { data, isLoading, isError } = usePredictions();

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (isError) return <p className="text-red-600">Failed to load predictions.</p>;
  if (!data) return null;

  if (data.season === null || data.games.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-500">
        No upcoming games with predictions yet. Once this season's schedule is ingested and the
        model has run, the next unplayed week will show up here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">
        Season {data.season} — Week {data.week}
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {data.games.map((g) => {
          const homeProb = g.home_win_probability;
          const played = g.home_score !== null && g.away_score !== null;
          return (
            <div key={g.game_id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between text-sm">
                <Link to={`/teams/${g.away_team}`} className="font-medium text-slate-900 hover:underline">
                  {g.away_team_name}
                </Link>
                <span className="text-slate-400">@</span>
                <Link to={`/teams/${g.home_team}`} className="font-medium text-slate-900 hover:underline">
                  {g.home_team_name}
                </Link>
              </div>

              {played ? (
                <p className="mt-2 text-center text-2xl font-bold text-slate-900">
                  {g.away_score} – {g.home_score}
                </p>
              ) : homeProb !== null ? (
                <div className="mt-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-blue-600"
                      style={{ width: `${Math.round(homeProb * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-center text-sm text-slate-600">
                    {g.home_team} win probability: {(homeProb * 100).toFixed(0)}%
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-center text-sm text-slate-400">Prediction pending</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
