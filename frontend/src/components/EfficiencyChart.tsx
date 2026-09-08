import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "../lib/theme.js";

export interface ChartSeries {
  dataKey: string;
  label: string;
  color: string;
}

interface Props {
  title: string;
  data: Record<string, unknown>[];
  series: ChartSeries[];
}

export function EfficiencyChart({ title, data, series }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const gridStroke = isDark ? "#334155" : "#e2e8f0";
  const tickFill = isDark ? "#94a3b8" : "#475569";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey="week" tick={{ fontSize: 12, fill: tickFill }} />
          <YAxis tick={{ fontSize: 12, fill: tickFill }} width={50} />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? "#1e293b" : "#fff",
              borderColor: isDark ? "#334155" : "#e2e8f0",
              color: isDark ? "#f1f5f9" : "#0f172a",
              fontSize: 12,
            }}
            labelStyle={{ color: isDark ? "#f1f5f9" : "#0f172a" }}
            itemStyle={{ color: isDark ? "#f1f5f9" : "#0f172a" }}
          />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: tickFill }} />}
          {series.map((s) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.label}
              stroke={s.color}
              dot={false}
              strokeWidth={2}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
