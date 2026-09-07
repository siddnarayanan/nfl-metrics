import { POSITION_GROUPS, type PositionGroup } from "../api/hooks.js";

interface Props {
  value: PositionGroup;
  onChange: (position: PositionGroup) => void;
}

export function PositionSelect({ value, onChange }: Props) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-600">
      Position
      <select
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
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
