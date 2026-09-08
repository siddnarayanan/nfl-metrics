import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RankedBarChart } from "../components/RankedBarChart.js";
import { MetricSelect } from "../components/MetricSelect.js";
import { METRIC_LABELS, useLeaderboard, type MetricColumn } from "../api/hooks.js";

export function LeaderboardPage() {
  const [metric, setMetric] = useState<MetricColumn>("epa_per_play");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const navigate = useNavigate();

  const { data, isLoading, isError } = useLeaderboard(metric, order, 32);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <MetricSelect value={metric} onChange={setMetric} />
        <label className="field-label">
          Order
          <select
            className="field-select"
            value={order}
            onChange={(e) => setOrder(e.target.value as "asc" | "desc")}
          >
            <option value="desc">Highest first</option>
            <option value="asc">Lowest first</option>
          </select>
        </label>
      </div>

      {isLoading && <p className="text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && <p className="text-red-600 dark:text-red-400">Failed to load the leaderboard.</p>}

      {data && (
        <RankedBarChart
          title={METRIC_LABELS[metric]}
          allowNegative
          footnote="Click a bar to open that team's page."
          data={data.map((entry) => ({
            key: entry.abbreviation,
            label: entry.abbreviation,
            tooltipLabel: entry.name,
            value: entry.value,
            color: entry.color,
            imageUrl: entry.logo_url,
          }))}
          onBarClick={(entry) => navigate(`/teams/${entry.key}`)}
        />
      )}
    </div>
  );
}
