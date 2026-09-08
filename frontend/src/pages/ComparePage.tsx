import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TeamSelect } from "../components/TeamSelect.js";
import { EfficiencyChart } from "../components/EfficiencyChart.js";
import { METRIC_COLUMNS, METRIC_LABELS, useCompare } from "../api/hooks.js";
import { mergeWeeksByTeam } from "../lib/chartData.js";

export function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [teamA, setTeamA] = useState(searchParams.get("teamA") ?? "");
  const [teamB, setTeamB] = useState(searchParams.get("teamB") ?? "");

  const { data, isLoading, isError } = useCompare(teamA, teamB);

  function updateTeamA(abbr: string) {
    setTeamA(abbr);
    setSearchParams({ teamA: abbr, teamB });
  }
  function updateTeamB(abbr: string) {
    setTeamB(abbr);
    setSearchParams({ teamA, teamB: abbr });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <TeamSelect label="Team A" value={teamA} onChange={updateTeamA} excludeAbbreviation={teamB} />
        <TeamSelect label="Team B" value={teamB} onChange={updateTeamB} excludeAbbreviation={teamA} />
      </div>

      {isLoading && teamA && teamB && (
        <p className="text-slate-500 dark:text-slate-400">Loading…</p>
      )}
      {isError && (
        <p className="text-red-600 dark:text-red-400">Couldn't load a comparison for those teams.</p>
      )}

      {data && (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="px-4 py-2 font-medium">Metric</th>
                  <th className="px-4 py-2 font-medium">{data.teamA.team.abbreviation}</th>
                  <th className="px-4 py-2 font-medium">{data.teamB.team.abbreviation}</th>
                </tr>
              </thead>
              <tbody>
                {METRIC_COLUMNS.map((m) => (
                  <tr key={m} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{METRIC_LABELS[m]}</td>
                    <td className="px-4 py-2 font-mono text-slate-900 dark:text-slate-100">
                      {data.teamA.averages[m]?.toFixed(3) ?? "—"}
                    </td>
                    <td className="px-4 py-2 font-mono text-slate-900 dark:text-slate-100">
                      {data.teamB.averages[m]?.toFixed(3) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {METRIC_COLUMNS.map((m) => (
              <EfficiencyChart
                key={m}
                title={METRIC_LABELS[m]}
                data={mergeWeeksByTeam(data.teamA.weeks, data.teamB.weeks, m)}
                series={[
                  {
                    dataKey: "teamA",
                    label: data.teamA.team.abbreviation,
                    color: data.teamA.team.color ?? "#2563eb",
                  },
                  {
                    dataKey: "teamB",
                    label: data.teamB.team.abbreviation,
                    color: data.teamB.team.color ?? "#dc2626",
                  },
                ]}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
