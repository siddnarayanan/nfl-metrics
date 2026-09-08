import { METRIC_COLUMNS, METRIC_LABELS, type MetricColumn } from "../api/hooks.js";

interface Props {
  value: MetricColumn;
  onChange: (metric: MetricColumn) => void;
}

export function MetricSelect({ value, onChange }: Props) {
  return (
    <label className="field-label">
      Metric
      <select
        className="field-select"
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
