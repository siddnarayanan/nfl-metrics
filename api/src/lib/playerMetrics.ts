export const POSITION_GROUPS = ["QB", "RB", "WR", "TE", "EDGE", "LB", "CB", "S"] as const;
export type PositionGroup = (typeof POSITION_GROUPS)[number];

export function isPositionGroup(value: string): value is PositionGroup {
  return (POSITION_GROUPS as readonly string[]).includes(value);
}

// nflverse's own `position` codes that map to each group we expose. EDGE and
// LB split DE/OLB and LB/MLB/ILB the way modern defensive analytics groups
// them; the ambiguous generic 'DB' tag is deliberately left out of both CB
// and S rather than guessed at.
export const POSITION_CODES: Record<PositionGroup, string[]> = {
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  EDGE: ["DE", "OLB"],
  LB: ["LB", "MLB", "ILB"],
  CB: ["CB"],
  S: ["SAF", "FS", "S"],
};

export interface PlayerMetricDef {
  // SQL expression over player_stats columns — always from this file, never
  // user input, so safe to interpolate directly.
  numerator: string;
  // A player_stats column to SUM, or the 'games' sentinel meaning COUNT(*).
  denominator: string | "games";
  label: string;
  // Whether this metric can go negative (true EPA-based rates) vs. a
  // strictly non-negative counting rate (defensive per-game stats, TD rate,
  // catch rate) — the frontend uses this to decide whether the chart axis
  // should be zero-centered or just start at 0.
  allowNegative: boolean;
}

export const PLAYER_METRICS: Record<PositionGroup, Record<string, PlayerMetricDef>> = {
  QB: {
    epa_per_attempt: {
      numerator: "passing_epa",
      denominator: "attempts",
      label: "EPA / attempt",
      allowNegative: true,
    },
    yards_per_attempt: {
      numerator: "passing_yards",
      denominator: "attempts",
      label: "Yards / attempt",
      allowNegative: false,
    },
    td_rate: {
      numerator: "passing_tds",
      denominator: "attempts",
      label: "TD rate",
      allowNegative: false,
    },
  },
  RB: {
    epa_per_carry: {
      numerator: "rushing_epa",
      denominator: "carries",
      label: "EPA / carry",
      allowNegative: true,
    },
    yards_per_carry: {
      numerator: "rushing_yards",
      denominator: "carries",
      label: "Yards / carry",
      allowNegative: false,
    },
  },
  WR: {
    epa_per_target: {
      numerator: "receiving_epa",
      denominator: "targets",
      label: "EPA / target",
      allowNegative: true,
    },
    yards_per_target: {
      numerator: "receiving_yards",
      denominator: "targets",
      label: "Yards / target",
      allowNegative: false,
    },
    catch_rate: {
      numerator: "receptions",
      denominator: "targets",
      label: "Catch rate",
      allowNegative: false,
    },
  },
  TE: {
    epa_per_target: {
      numerator: "receiving_epa",
      denominator: "targets",
      label: "EPA / target",
      allowNegative: true,
    },
    yards_per_target: {
      numerator: "receiving_yards",
      denominator: "targets",
      label: "Yards / target",
      allowNegative: false,
    },
    catch_rate: {
      numerator: "receptions",
      denominator: "targets",
      label: "Catch rate",
      allowNegative: false,
    },
  },
  EDGE: {
    sacks_per_game: {
      numerator: "def_sacks",
      denominator: "games",
      label: "Sacks / game",
      allowNegative: false,
    },
    qb_hits_per_game: {
      numerator: "def_qb_hits",
      denominator: "games",
      label: "QB hits / game",
      allowNegative: false,
    },
    tfl_per_game: {
      numerator: "def_tackles_for_loss",
      denominator: "games",
      label: "TFL / game",
      allowNegative: false,
    },
  },
  LB: {
    tackles_per_game: {
      numerator: "(def_tackles_solo + def_tackles_with_assist)",
      denominator: "games",
      label: "Tackles / game",
      allowNegative: false,
    },
    tfl_per_game: {
      numerator: "def_tackles_for_loss",
      denominator: "games",
      label: "TFL / game",
      allowNegative: false,
    },
  },
  CB: {
    int_per_game: {
      numerator: "def_interceptions",
      denominator: "games",
      label: "INT / game",
      allowNegative: false,
    },
    pass_defended_per_game: {
      numerator: "def_pass_defended",
      denominator: "games",
      label: "Passes defended / game",
      allowNegative: false,
    },
  },
  S: {
    int_per_game: {
      numerator: "def_interceptions",
      denominator: "games",
      label: "INT / game",
      allowNegative: false,
    },
    pass_defended_per_game: {
      numerator: "def_pass_defended",
      denominator: "games",
      label: "Passes defended / game",
      allowNegative: false,
    },
    tackles_per_game: {
      numerator: "(def_tackles_solo + def_tackles_with_assist)",
      denominator: "games",
      label: "Tackles / game",
      allowNegative: false,
    },
  },
};

// "Starter" qualification proxy — no snap-count data available, so this is
// a volume cutoff calibrated against real 2025 percentiles (offense) or
// games-played (defense, where full-season regulars cluster at 16-17 games).
export const MIN_VOLUME: Record<PositionGroup, { column: string | "games"; min: number }> = {
  QB: { column: "attempts", min: 150 },
  RB: { column: "carries", min: 80 },
  WR: { column: "targets", min: 40 },
  TE: { column: "targets", min: 25 },
  EDGE: { column: "games", min: 8 },
  LB: { column: "games", min: 8 },
  CB: { column: "games", min: 8 },
  S: { column: "games", min: 8 },
};

export function isPlayerMetric(position: PositionGroup, metric: string): boolean {
  return metric in PLAYER_METRICS[position];
}
