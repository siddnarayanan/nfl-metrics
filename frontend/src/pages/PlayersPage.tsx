import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PositionSelect } from "../components/PositionSelect.js";
import { RankedBarChart } from "../components/RankedBarChart.js";
import { PlayerScatterChart } from "../components/PlayerScatterChart.js";
import { humanizeMetricKey, usePlayers, type PositionGroup } from "../api/hooks.js";

const viewTabClass = (active: boolean) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    active
      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
  }`;

export function PlayersPage() {
  const [position, setPosition] = useState<PositionGroup>("QB");
  const [view, setView] = useState<"ranked" | "scatter">("ranked");
  const [metric, setMetric] = useState<string | null>(null);
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [xMetric, setXMetric] = useState<string | null>(null);
  const [yMetric, setYMetric] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data, isLoading, isError } = usePlayers(
    position,
    (view === "ranked" ? metric : xMetric) ?? undefined,
    order,
    25
  );
  const currentMetric = metric ?? data?.metrics[0];
  const currentX = xMetric ?? data?.metrics[0];
  const currentY = yMetric ?? data?.metrics[1] ?? data?.metrics[0];

  function handlePositionChange(p: PositionGroup) {
    setPosition(p);
    setMetric(null);
    setXMetric(null);
    setYMetric(null);
  }

  function goToPlayerTeam(playerId: string) {
    const player = data?.players.find((p) => p.player_id === playerId);
    if (player) navigate(`/teams/${player.team_abbreviation}`);
  }

  const allowNegative =
    !!currentMetric && !!data?.players.some((p) => (p.values[currentMetric] ?? 0) < 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <PositionSelect value={position} onChange={handlePositionChange} />

        <div className="flex gap-1">
          <button className={viewTabClass(view === "ranked")} onClick={() => setView("ranked")}>
            Ranked
          </button>
          <button className={viewTabClass(view === "scatter")} onClick={() => setView("scatter")}>
            Scatter (2 metrics)
          </button>
        </div>

        {view === "ranked" && data && currentMetric && (
          <>
            <label className="field-label">
              Metric
              <select
                className="field-select"
                value={currentMetric}
                onChange={(e) => setMetric(e.target.value)}
              >
                {data.metrics.map((m) => (
                  <option key={m} value={m}>
                    {humanizeMetricKey(m)}
                  </option>
                ))}
              </select>
            </label>
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
          </>
        )}

        {view === "scatter" && data && currentX && currentY && (
          <>
            <label className="field-label">
              X axis
              <select
                className="field-select"
                value={currentX}
                onChange={(e) => setXMetric(e.target.value)}
              >
                {data.metrics.map((m) => (
                  <option key={m} value={m}>
                    {humanizeMetricKey(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Y axis
              <select
                className="field-select"
                value={currentY}
                onChange={(e) => setYMetric(e.target.value)}
              >
                {data.metrics.map((m) => (
                  <option key={m} value={m}>
                    {humanizeMetricKey(m)}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      {isLoading && <p className="text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && <p className="text-red-600 dark:text-red-400">Failed to load players.</p>}

      {data && view === "ranked" && currentMetric && (
        <RankedBarChart
          title={humanizeMetricKey(currentMetric)}
          allowNegative={allowNegative}
          yAxisWidth={110}
          footnote="Click a bar to open that player's team page. 'Starter' is approximated by a minimum volume cutoff — see the README for details."
          data={data.players.map((p) => ({
            key: p.player_id,
            label: p.name,
            tooltipLabel: `${p.name} (${p.team_abbreviation})`,
            value: p.values[currentMetric] ?? 0,
            color: p.team_color,
            imageUrl: p.headshot_url ?? p.team_logo_url,
          }))}
          onBarClick={(entry) => goToPlayerTeam(entry.key)}
        />
      )}

      {data && view === "scatter" && currentX && currentY && (
        <PlayerScatterChart
          xLabel={humanizeMetricKey(currentX)}
          yLabel={humanizeMetricKey(currentY)}
          data={data.players
            .filter((p) => p.values[currentX] != null && p.values[currentY] != null)
            .map((p) => ({
              key: p.player_id,
              label: p.name,
              tooltipLabel: `${p.name} (${p.team_abbreviation})`,
              x: p.values[currentX] as number,
              y: p.values[currentY] as number,
              color: p.team_color,
            }))}
          onPointClick={(point) => goToPlayerTeam(point.key)}
        />
      )}
    </div>
  );
}
