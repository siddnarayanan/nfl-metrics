import type { components } from "../api/client.js";

type TeamWeekMetrics = components["schemas"]["TeamWeekMetrics"];

export function mergeWeeksByTeam(
  weeksA: TeamWeekMetrics[],
  weeksB: TeamWeekMetrics[],
  metric: keyof TeamWeekMetrics
) {
  const weeks = Array.from(
    new Set([...weeksA.map((w) => w.week), ...weeksB.map((w) => w.week)])
  ).sort((a, b) => a - b);

  return weeks.map((week) => ({
    week,
    teamA: weeksA.find((w) => w.week === week)?.[metric] ?? null,
    teamB: weeksB.find((w) => w.week === week)?.[metric] ?? null,
  }));
}
