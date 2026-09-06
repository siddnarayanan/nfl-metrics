-- NFL Team Efficiency Dashboard schema

CREATE TABLE IF NOT EXISTS teams (
    id           SERIAL PRIMARY KEY,
    name         TEXT NOT NULL,
    abbreviation TEXT NOT NULL UNIQUE,
    conference   TEXT,
    division     TEXT
);

-- id is nflverse's own game_id (e.g. '2025_01_DAL_PHI'): stable, unique,
-- and lets player_stats join on it directly without a synthetic key.
CREATE TABLE IF NOT EXISTS games (
    id            TEXT PRIMARY KEY,
    season        INT NOT NULL,
    week          INT NOT NULL,
    season_type   TEXT NOT NULL, -- REG, WC, DIV, CON, SB
    home_team_id  INT REFERENCES teams(id),
    away_team_id  INT REFERENCES teams(id),
    home_score    INT,
    away_score    INT,
    date          DATE
);

-- Mirrors nflverse's stats_player_week release column-for-column (offense,
-- defense, kicking, punting, returns, fantasy). player_id is nflverse's own
-- GSIS id; (player_id, game_id) is the natural key for a player's week.
CREATE TABLE IF NOT EXISTS player_stats (
    id                            SERIAL PRIMARY KEY,
    player_id                     TEXT NOT NULL,
    player_name                   TEXT NOT NULL,
    player_display_name           TEXT,
    position                      TEXT,
    position_group                TEXT,
    headshot_url                  TEXT,
    season                        INT NOT NULL,
    week                          INT NOT NULL,
    season_type                   TEXT NOT NULL,
    game_id                       TEXT REFERENCES games(id),
    team_id                       INT REFERENCES teams(id),
    opponent_team_id              INT REFERENCES teams(id),

    -- passing
    completions                   INT DEFAULT 0,
    attempts                      INT DEFAULT 0,
    passing_yards                 INT DEFAULT 0,
    passing_tds                   INT DEFAULT 0,
    passing_interceptions         INT DEFAULT 0,
    sacks_suffered                INT DEFAULT 0,
    sack_yards_lost               INT DEFAULT 0,
    sack_fumbles                  INT DEFAULT 0,
    sack_fumbles_lost             INT DEFAULT 0,
    passing_air_yards             INT DEFAULT 0,
    passing_yards_after_catch     INT DEFAULT 0,
    passing_first_downs           INT DEFAULT 0,
    passing_epa                   DOUBLE PRECISION,
    passing_cpoe                  DOUBLE PRECISION,
    passing_2pt_conversions       INT DEFAULT 0,
    pacr                          DOUBLE PRECISION,
    passing_10                    INT DEFAULT 0,
    passing_16                    INT DEFAULT 0,
    passing_20                    INT DEFAULT 0,
    passing_40                    INT DEFAULT 0,

    -- rushing
    carries                       INT DEFAULT 0,
    rushing_yards                 INT DEFAULT 0,
    rushing_tds                   INT DEFAULT 0,
    rushing_fumbles               INT DEFAULT 0,
    rushing_fumbles_lost          INT DEFAULT 0,
    rushing_first_downs           INT DEFAULT 0,
    rushing_epa                   DOUBLE PRECISION,
    rushing_2pt_conversions       INT DEFAULT 0,
    rushing_10                    INT DEFAULT 0,
    rushing_12                    INT DEFAULT 0,
    rushing_20                    INT DEFAULT 0,
    rushing_40                    INT DEFAULT 0,

    -- receiving
    receptions                    INT DEFAULT 0,
    targets                       INT DEFAULT 0,
    receiving_yards                INT DEFAULT 0,
    receiving_tds                 INT DEFAULT 0,
    receiving_fumbles             INT DEFAULT 0,
    receiving_fumbles_lost        INT DEFAULT 0,
    receiving_air_yards           INT DEFAULT 0,
    receiving_yards_after_catch   INT DEFAULT 0,
    receiving_first_downs         INT DEFAULT 0,
    receiving_epa                 DOUBLE PRECISION,
    receiving_2pt_conversions     INT DEFAULT 0,
    receiving_10                  INT DEFAULT 0,
    receiving_16                  INT DEFAULT 0,
    receiving_20                  INT DEFAULT 0,
    receiving_40                  INT DEFAULT 0,
    racr                          DOUBLE PRECISION,
    target_share                  DOUBLE PRECISION,
    air_yards_share                DOUBLE PRECISION,
    wopr                          DOUBLE PRECISION,

    -- special teams / defense
    special_teams_tds             INT DEFAULT 0,
    def_tackles_solo              INT DEFAULT 0,
    def_tackles_with_assist       INT DEFAULT 0,
    def_tackle_assists            INT DEFAULT 0,
    def_tackles_for_loss          INT DEFAULT 0,
    def_tackles_for_loss_yards    INT DEFAULT 0,
    def_fumbles_forced            INT DEFAULT 0,
    def_sacks                     DOUBLE PRECISION,
    def_sack_yards                DOUBLE PRECISION,
    def_qb_hits                   INT DEFAULT 0,
    def_interceptions             INT DEFAULT 0,
    def_interception_yards        INT DEFAULT 0,
    def_pass_defended             INT DEFAULT 0,
    def_tds                       INT DEFAULT 0,
    def_fumbles                   INT DEFAULT 0,
    def_safeties                  INT DEFAULT 0,
    def_punt_blocks               INT DEFAULT 0,
    def_pat_blocks                INT DEFAULT 0,
    def_fg_blocks                 INT DEFAULT 0,
    def_2pt_atts                  INT DEFAULT 0,
    def_2pt_made                  INT DEFAULT 0,

    -- fumbles / penalties
    misc_yards                    INT DEFAULT 0,
    fumble_recovery_own           INT DEFAULT 0,
    fumble_recovery_yards_own     INT DEFAULT 0,
    fumble_recovery_opp           INT DEFAULT 0,
    fumble_recovery_yards_opp     INT DEFAULT 0,
    fumble_recovery_tds           INT DEFAULT 0,
    penalties                     INT DEFAULT 0,
    penalty_yards                 INT DEFAULT 0,
    fumbles_forced_by_opp         INT DEFAULT 0,
    fumbles_not_forced            INT DEFAULT 0,
    fumbles_out_of_bounds         INT DEFAULT 0,
    fumbles_total                 INT DEFAULT 0,
    fumbles_lost_total            INT DEFAULT 0,

    -- returns
    punt_returns                  INT DEFAULT 0,
    punt_return_yards             INT DEFAULT 0,
    kickoff_returns                INT DEFAULT 0,
    kickoff_return_yards          INT DEFAULT 0,

    -- kicking
    fg_made                       INT DEFAULT 0,
    fg_att                        INT DEFAULT 0,
    fg_missed                     INT DEFAULT 0,
    fg_blocked                    INT DEFAULT 0,
    fg_long                       DOUBLE PRECISION,
    fg_pct                        DOUBLE PRECISION,
    fg_made_0_19                  INT DEFAULT 0,
    fg_made_20_29                 INT DEFAULT 0,
    fg_made_30_39                 INT DEFAULT 0,
    fg_made_40_49                 INT DEFAULT 0,
    fg_made_50_59                 INT DEFAULT 0,
    fg_made_60_                   INT DEFAULT 0,
    fg_missed_0_19                INT DEFAULT 0,
    fg_missed_20_29               INT DEFAULT 0,
    fg_missed_30_39               INT DEFAULT 0,
    fg_missed_40_49               INT DEFAULT 0,
    fg_missed_50_59               INT DEFAULT 0,
    fg_missed_60_                 INT DEFAULT 0,
    fg_made_list                  TEXT,
    fg_missed_list                 TEXT,
    fg_blocked_list                TEXT,
    fg_made_distance               INT DEFAULT 0,
    fg_missed_distance             INT DEFAULT 0,
    fg_blocked_distance            INT DEFAULT 0,
    pat_made                      INT DEFAULT 0,
    pat_att                       INT DEFAULT 0,
    pat_missed                    INT DEFAULT 0,
    pat_blocked                   INT DEFAULT 0,
    pat_pct                       DOUBLE PRECISION,
    gwfg_made                     INT DEFAULT 0,
    gwfg_att                      INT DEFAULT 0,
    gwfg_missed                   INT DEFAULT 0,
    gwfg_blocked                  INT DEFAULT 0,
    gwfg_distance                 INT DEFAULT 0,

    -- punting
    pt_att                        INT DEFAULT 0,
    pt_blocked                    INT DEFAULT 0,
    pt_long                       DOUBLE PRECISION,
    pt_yards                      INT DEFAULT 0,
    pt_inside_20                  INT DEFAULT 0,
    pt_out_of_bounds              INT DEFAULT 0,
    pt_downed                     INT DEFAULT 0,
    pt_touchback                  INT DEFAULT 0,
    pt_fair_caught                INT DEFAULT 0,
    pt_returned                   INT DEFAULT 0,
    pt_return_yards               INT DEFAULT 0,
    pt_return_tds                 INT DEFAULT 0,
    pt_net_yards                  INT DEFAULT 0,

    -- fantasy
    fantasy_points                DOUBLE PRECISION,
    fantasy_points_ppr            DOUBLE PRECISION,

    UNIQUE (player_id, game_id)
);

-- season is not in the original 4-table sketch, but is required once more
-- than one season is loaded (2025 now, 2026 as it plays out) so week numbers
-- don't collide across seasons.
--
-- *_allowed columns are the defensive mirror (grouped by defteam instead of
-- posteam in ingest.py). st_* columns are special teams (field goals, punts,
-- kickoffs, extra points), scoped separately from offense/defense scrimmage
-- plays since those play types don't belong in an offensive efficiency number.
CREATE TABLE IF NOT EXISTS team_week_stats (
    id                        SERIAL PRIMARY KEY,
    team_id                   INT REFERENCES teams(id),
    season                    INT NOT NULL,
    week                      INT NOT NULL,
    epa_per_play              REAL,
    success_rate              REAL,
    points_per_drive          REAL,
    epa_per_play_allowed      REAL,
    success_rate_allowed      REAL,
    points_per_drive_allowed  REAL,
    st_epa_per_play           REAL,
    st_epa_per_play_allowed   REAL,
    UNIQUE (team_id, season, week)
);

-- One row per game, refreshed by predict.py each run for every game with no
-- final score yet. Left untouched once a game is played, so stored
-- predictions can later be compared against actual outcomes.
CREATE TABLE IF NOT EXISTS game_predictions (
    game_id               TEXT PRIMARY KEY REFERENCES games(id),
    home_win_probability  REAL NOT NULL,
    predicted_at          TIMESTAMP NOT NULL DEFAULT now()
);
