import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          Order
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
            value={order}
            onChange={(e) => setOrder(e.target.value as "asc" | "desc")}
          >
            <option value="desc">Highest first</option>
            <option value="asc">Lowest first</option>
          </select>
        </label>
      </div>

      {isLoading && <p className="text-slate-500">Loading…</p>}
      {isError && <p className="text-red-600">Failed to load the leaderboard.</p>}

      {data && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            {METRIC_LABELS[metric]}
          </h2>
          <ResponsiveContainer width="100%" height={Math.max(320, data.length * 24)}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              onClick={(state) => {
                if (typeof state?.activeLabel === "string") navigate(`/teams/${state.activeLabel}`);
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="abbreviation"
                width={50}
                tick={{ fontSize: 12 }}
                interval={0}
              />
              <Tooltip
                formatter={(value) => (typeof value === "number" ? value.toFixed(3) : value)}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} cursor="pointer">
                {data.map((entry) => (
                  <Cell key={entry.abbreviation} fill={entry.value >= 0 ? "#2563eb" : "#dc2626"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-slate-400">Click a bar to open that team's page.</p>
        </div>
      )}
    </div>
  );
}
