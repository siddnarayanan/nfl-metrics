import { useNavigate, useParams } from "react-router-dom";
import { TeamSelect } from "../components/TeamSelect.js";
import { EfficiencyChart } from "../components/EfficiencyChart.js";
import { useTeamStats } from "../api/hooks.js";

export function TeamPage() {
  const { abbreviation = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useTeamStats(abbreviation);

  return (
    <div className="space-y-4">
      <TeamSelect
        label="Team"
        value={abbreviation}
        onChange={(abbr) => navigate(`/teams/${abbr}`)}
      />

      {isLoading && <p className="text-slate-500">Loading…</p>}
      {isError && <p className="text-red-600">No data for that team.</p>}

      {data && (
        <>
          <h2 className="text-lg font-semibold text-slate-900">
            {data.team.name} — {data.season} season
          </h2>

          <section>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              Offense
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <EfficiencyChart
                title="EPA / play"
                data={data.weeks}
                series={[{ dataKey: "epa_per_play", label: "EPA/play", color: "#2563eb" }]}
              />
              <EfficiencyChart
                title="Success rate"
                data={data.weeks}
                series={[{ dataKey: "success_rate", label: "Success rate", color: "#2563eb" }]}
              />
              <EfficiencyChart
                title="Points / drive"
                data={data.weeks}
                series={[{ dataKey: "points_per_drive", label: "Points/drive", color: "#2563eb" }]}
              />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              Defense
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <EfficiencyChart
                title="EPA / play allowed"
                data={data.weeks}
                series={[{ dataKey: "epa_per_play_allowed", label: "EPA/play allowed", color: "#dc2626" }]}
              />
              <EfficiencyChart
                title="Success rate allowed"
                data={data.weeks}
                series={[{ dataKey: "success_rate_allowed", label: "Success rate allowed", color: "#dc2626" }]}
              />
              <EfficiencyChart
                title="Points / drive allowed"
                data={data.weeks}
                series={[{ dataKey: "points_per_drive_allowed", label: "Points/drive allowed", color: "#dc2626" }]}
              />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              Special teams
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <EfficiencyChart
                title="Special teams EPA / play"
                data={data.weeks}
                series={[
                  { dataKey: "st_epa_per_play", label: "Own units", color: "#16a34a" },
                  { dataKey: "st_epa_per_play_allowed", label: "Allowed", color: "#dc2626" },
                ]}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
