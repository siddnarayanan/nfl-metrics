import { METRIC_COLUMNS, METRIC_LABELS, type MetricColumn } from "../api/hooks.js";

interface Props {
  value: MetricColumn;
  onChange: (metric: MetricColumn) => void;
}

export function MetricSelect({ value, onChange }: Props) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-600">
      Metric
      <select
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
        value={value}
        onChange={(e) => onChange(e.target.value as MetricColumn)}
      >
        {METRIC_COLUMNS.map((m) => (
          <option key={m} value={m}>
            {METRIC_LABELS[m]}
          </option>
        ))}
      </select>
    </label>
  );
}
