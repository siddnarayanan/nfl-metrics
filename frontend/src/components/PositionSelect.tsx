import { POSITION_GROUPS, type PositionGroup } from "../api/hooks.js";

interface Props {
  value: PositionGroup;
  onChange: (position: PositionGroup) => void;
}

export function PositionSelect({ value, onChange }: Props) {
  return (
    <label className="field-label">
      Position
      <select
        className="field-select"
        value={value}
        onChange={(e) => onChange(e.target.value as PositionGroup)}
      >
        {POSITION_GROUPS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </label>
  );
}
