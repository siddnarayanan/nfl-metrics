import { useTeams } from "../api/hooks.js";

interface Props {
  value: string;
  onChange: (abbreviation: string) => void;
  label?: string;
  excludeAbbreviation?: string;
}

export function TeamSelect({ value, onChange, label, excludeAbbreviation }: Props) {
  const { data: teams, isLoading } = useTeams();

  return (
    <label className="flex flex-col gap-1 text-sm text-slate-600">
      {label}
      <select
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
        value={value}
        disabled={isLoading}
        onChange={(e) => onChange(e.target.value)}
      >
        {!value && <option value="">Select a team…</option>}
        {teams
          ?.filter((t) => t.abbreviation !== excludeAbbreviation)
          .map((t) => (
            <option key={t.abbreviation} value={t.abbreviation}>
              {t.name} ({t.abbreviation})
            </option>
          ))}
      </select>
    </label>
  );
}
