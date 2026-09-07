import { useQuery } from "@tanstack/react-query";
import { api, type components } from "./client.js";

export type MetricColumn = components["schemas"]["MetricColumn"];

export const METRIC_COLUMNS: MetricColumn[] = [
  "epa_per_play",
  "success_rate",
  "points_per_drive",
  "epa_per_play_allowed",
  "success_rate_allowed",
  "points_per_drive_allowed",
  "st_epa_per_play",
  "st_epa_per_play_allowed",
];

export const METRIC_LABELS: Record<MetricColumn, string> = {
  epa_per_play: "EPA / play (offense)",
  success_rate: "Success rate (offense)",
  points_per_drive: "Points / drive (offense)",
  epa_per_play_allowed: "EPA / play allowed (defense)",
  success_rate_allowed: "Success rate allowed (defense)",
  points_per_drive_allowed: "Points / drive allowed (defense)",
  st_epa_per_play: "Special teams EPA / play",
  st_epa_per_play_allowed: "Special teams EPA / play allowed",
};

async function unwrap<T>(promise: Promise<{ data?: T; error?: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data as T;
}

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: () => unwrap(api.GET("/api/teams")),
  });
}

export function useTeamStats(abbreviation: string | undefined, season?: number) {
  return useQuery({
    queryKey: ["teamStats", abbreviation, season],
    queryFn: () =>
      unwrap(
        api.GET("/api/teams/{abbreviation}/stats", {
          params: { path: { abbreviation: abbreviation! }, query: { season } },
        })
      ),
    enabled: !!abbreviation,
  });
}

export function useCompare(teamA: string, teamB: string, season?: number) {
  return useQuery({
    queryKey: ["compare", teamA, teamB, season],
    queryFn: () =>
      unwrap(api.GET("/api/compare", { params: { query: { teamA, teamB, season } } })),
    enabled: !!teamA && !!teamB,
  });
}

export function useLeaderboard(
  metric: MetricColumn,
  order: "asc" | "desc",
  limit: number,
  season?: number
) {
  return useQuery({
    queryKey: ["leaderboard", metric, order, limit, season],
    queryFn: () =>
      unwrap(api.GET("/api/leaderboard", { params: { query: { metric, order, limit, season } } })),
  });
}

export function usePredictions(season?: number, week?: number) {
  return useQuery({
    queryKey: ["predictions", season, week],
    queryFn: () => unwrap(api.GET("/api/predictions", { params: { query: { season, week } } })),
  });
}
