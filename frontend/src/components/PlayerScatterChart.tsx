import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "../lib/theme.js";

export interface ScatterPoint {
  key: string;
  label: string;
  tooltipLabel?: string;
  x: number;
  y: number;
  color?: string | null;
}

interface Props {
  data: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  onPointClick?: (point: ScatterPoint) => void;
}

function niceBounds(values: number[]): [number, number] {
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const pad = (max - min) * 0.12 || 1;
  // Only pad below 0 if the data actually goes negative — otherwise the
  // axis should start exactly at 0, same convention as the ranked bar chart.
  const lo = min < 0 ? min - pad : 0;
  return [lo, max + pad];
}

export function PlayerScatterChart({ data, xLabel, yLabel, onPointClick }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const gridStroke = isDark ? "#334155" : "#e2e8f0";
  const tickFill = isDark ? "#94a3b8" : "#475569";
  const refLineStroke = isDark ? "#475569" : "#cbd5e1";

  const [xMin, xMax] = niceBounds(data.map((d) => d.x));
  const [yMin, yMax] = niceBounds(data.map((d) => d.y));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
        {yLabel} vs. {xLabel}
      </h2>
      <ResponsiveContainer width="100%" height={480}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            domain={[xMin, xMax]}
            tick={{ fontSize: 12, fill: tickFill }}
            tickFormatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)}
            label={{ value: xLabel, position: "insideBottom", offset: -10, fontSize: 12, fill: tickFill }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yLabel}
            domain={[yMin, yMax]}
            tick={{ fontSize: 12, fill: tickFill }}
            tickFormatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)}
            label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 12, fill: tickFill }}
          />
          {xMin < 0 && xMax > 0 && <ReferenceLine x={0} stroke={refLineStroke} />}
          {yMin < 0 && yMax > 0 && <ReferenceLine y={0} stroke={refLineStroke} />}
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as ScatterPoint;
              return (
                <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow dark:border-slate-700 dark:bg-slate-800">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {p.tooltipLabel ?? p.label}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    {xLabel}: {p.x.toFixed(3)}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    {yLabel}: {p.y.toFixed(3)}
                  </div>
                </div>
              );
            }}
          />
          <Scatter
            data={data}
            cursor={onPointClick ? "pointer" : undefined}
            onClick={(point) => onPointClick?.(point as unknown as ScatterPoint)}
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.color ?? "#64748b"} fillOpacity={0.85} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
