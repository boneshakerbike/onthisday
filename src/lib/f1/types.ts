/**
 * F1 Data Types and Adapter Interface
 * All types are adapter-agnostic ΓÇö any F1 data provider must normalize to these.
 */

// ΓöÇΓöÇ Normalized Result Types ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export interface F1DriverResult {
  position: number;
  driver_id: string;         // Stable ID like 'max_verstappen'
  driver_code: string;       // 'VER'
  given_name: string;
  family_name: string;
  constructor_id: string;
  constructor_name: string;
  grid: number;
  laps: number;
  status: string;            // 'Finished', '+1 Lap', 'Retired', etc.
  time_text: string | null;  // '1:31:44.742' or '+22.457' or Q time
  fastest_lap_rank: number | null;
}

export interface F1SessionResult {
  season: number;
  round: number;
  session_type: SessionType;
  race_name: string;
  results: F1DriverResult[];
  fastest_lap_driver_id: string | null;
}

export interface F1RaceSchedule {
  season: number;
  round: number;
  race_name: string;
  circuit_id: string;
  circuit_name: string;
  country: string;
  locality: string;
  race_date: string;       // YYYY-MM-DD
  race_time: string | null; // HH:MM:SSZ
  is_sprint_weekend: boolean;
}

export interface F1Driver {
  driver_id: string;
  code: string;
  given_name: string;
  family_name: string;
  constructor_id: string;
  constructor_name: string;
}

// ΓöÇΓöÇ Session & State Types ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export type SessionType = 'qualifying' | 'sprint' | 'race';

export type PlayerState = 'predicting' | 'watching' | 'revealed';

export interface F1Prediction {
  id: string;
  season: number;
  round: number;
  session_type: SessionType;
  player_name: string;
  p1: string;
  p2: string;
  p3: string;
  fastest_lap: string | null;
  created_at: string;
}

export interface F1Score {
  prediction_id: string;
  perfect_match: number;
  podium_lock: number;
  almost: number;
  fastest_lap: number;
  total: number;
  computed_at: string;
}

export interface F1PlayerState {
  season: number;
  round: number;
  session_type: SessionType;
  player_name: string;
  state: PlayerState;
  updated_at: string;
}

// ΓöÇΓöÇ Scoring Constants ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export const POINTS = {
  perfect_match: 5,
  podium_lock: 2,
  almost: 1,
  fastest_lap: 3,
} as const;

// Session order for step-lock progression
export const STANDARD_WEEKEND: SessionType[] = ['qualifying', 'race'];
export const SPRINT_WEEKEND: SessionType[] = ['sprint', 'qualifying', 'race'];

// ΓöÇΓöÇ Adapter Interface ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export interface F1DataAdapter {
  fetch_schedule(season: number): Promise<F1RaceSchedule[]>;
  fetch_drivers(season: number): Promise<F1Driver[]>;
  fetch_results(
    season: number,
    round: number,
    session_type: SessionType
  ): Promise<F1SessionResult>;
}
