export interface Team {
  id: number;
  name: string;
  abbreviation: string;
  conference: string | null;
  division: string | null;
  logo_url: string | null;
  color: string | null;
  color2: string | null;
}

export interface TeamWeekMetrics {
  week: number;
  epa_per_play: number | null;
  success_rate: number | null;
  points_per_drive: number | null;
  epa_per_play_allowed: number | null;
  success_rate_allowed: number | null;
  points_per_drive_allowed: number | null;
  st_epa_per_play: number | null;
  st_epa_per_play_allowed: number | null;
}

export const METRIC_COLUMNS = [
  "epa_per_play",
  "success_rate",
  "points_per_drive",
  "epa_per_play_allowed",
  "success_rate_allowed",
  "points_per_drive_allowed",
  "st_epa_per_play",
  "st_epa_per_play_allowed",
] as const;

export type MetricColumn = (typeof METRIC_COLUMNS)[number];
