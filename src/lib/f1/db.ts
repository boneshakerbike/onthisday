/**
 * F1 Predictors Championship ΓÇö Database Layer
 * Uses the same Turso/libSQL client as the main app.
 */

import { createClient, Client } from '@libsql/client';
import type {
  F1RaceSchedule, F1Driver, F1DriverResult, F1SessionResult,
  F1Prediction, F1Score, F1PlayerState, SessionType, PlayerState,
} from './types';

// ΓöÇΓöÇ Client (shared singleton with main db.ts) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const is_turso = !!process.env.TURSO_DATABASE_URL;
let client: Client | null = null;

function get_client(): Client {
  if (!client) {
    if (is_turso) {
      client = createClient({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
    } else {
      const path = require('path');
      const fs = require('fs');
      const db_path = path.join(process.cwd(), 'data', 'posts.db');
      const dir = path.dirname(db_path);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      client = createClient({ url: `file:${db_path}` });
    }
  }
  return client;
}

// ΓöÇΓöÇ Schema Initialization ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

let schema_initialized = false;

async function init_f1_schema(): Promise<void> {
  const db = get_client();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS f1_seasons (
      season INTEGER NOT NULL,
      round INTEGER NOT NULL,
      race_name TEXT NOT NULL,
      circuit_id TEXT NOT NULL,
      circuit_name TEXT NOT NULL,
      country TEXT NOT NULL,
      locality TEXT NOT NULL,
      race_date TEXT NOT NULL,
      race_time TEXT,
      is_sprint_weekend INTEGER NOT NULL DEFAULT 0,
      fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (season, round)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS f1_sessions (
      id TEXT PRIMARY KEY,
      season INTEGER NOT NULL,
      round INTEGER NOT NULL,
      session_type TEXT NOT NULL,
      results_json TEXT NOT NULL,
      fastest_lap_driver_id TEXT,
      fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
      source TEXT NOT NULL DEFAULT 'jolpica'
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_f1_sessions_lookup
      ON f1_sessions(season, round, session_type)
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS f1_drivers (
      season INTEGER NOT NULL,
      driver_id TEXT NOT NULL,
      code TEXT NOT NULL,
      given_name TEXT NOT NULL,
      family_name TEXT NOT NULL,
      constructor_name TEXT NOT NULL,
      constructor_id TEXT NOT NULL,
      PRIMARY KEY (season, driver_id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS f1_predictions (
      id TEXT PRIMARY KEY,
      season INTEGER NOT NULL,
      round INTEGER NOT NULL,
      session_type TEXT NOT NULL,
      player_name TEXT NOT NULL,
      p1 TEXT NOT NULL,
      p2 TEXT NOT NULL,
      p3 TEXT NOT NULL,
      fastest_lap TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(season, round, session_type, player_name)
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_f1_predictions_lookup
      ON f1_predictions(season, round, session_type)
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS f1_scores (
      prediction_id TEXT PRIMARY KEY,
      perfect_match INTEGER NOT NULL DEFAULT 0,
      podium_lock INTEGER NOT NULL DEFAULT 0,
      almost INTEGER NOT NULL DEFAULT 0,
      fastest_lap INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      computed_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS f1_player_state (
      season INTEGER NOT NULL,
      round INTEGER NOT NULL,
      session_type TEXT NOT NULL,
      player_name TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'predicting',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (season, round, session_type, player_name)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS f1_roster (
      season INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      added_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (season, player_name)
    )
  `);
}

async function ensure_f1_schema(): Promise<void> {
  if (!schema_initialized) {
    await init_f1_schema();
    schema_initialized = true;
  }
}

// ΓöÇΓöÇ ID Generation ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

function generate_id(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function session_id(season: number, round: number, session_type: string): string {
  return `${season}_${round}_${session_type}`;
}

// ΓöÇΓöÇ Schedule CRUD ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export async function get_cached_schedule(season: number): Promise<F1RaceSchedule[] | null> {
  await ensure_f1_schema();
  const db = get_client();

  const result = await db.execute({
    sql: 'SELECT * FROM f1_seasons WHERE season = ? ORDER BY round ASC',
    args: [season],
  });

  if (result.rows.length === 0) return null;

  return result.rows.map(row => ({
    season: row.season as number,
    round: row.round as number,
    race_name: row.race_name as string,
    circuit_id: row.circuit_id as string,
    circuit_name: row.circuit_name as string,
    country: row.country as string,
    locality: row.locality as string,
    race_date: row.race_date as string,
    race_time: (row.race_time as string) || null,
    is_sprint_weekend: (row.is_sprint_weekend as number) === 1,
  }));
}

export async function save_schedule(races: F1RaceSchedule[]): Promise<void> {
  await ensure_f1_schema();
  const db = get_client();

  for (const race of races) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO f1_seasons
            (season, round, race_name, circuit_id, circuit_name, country, locality, race_date, race_time, is_sprint_weekend)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        race.season, race.round, race.race_name, race.circuit_id,
        race.circuit_name, race.country, race.locality,
        race.race_date, race.race_time, race.is_sprint_weekend ? 1 : 0,
      ],
    });
  }
}

// ΓöÇΓöÇ Drivers CRUD ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export async function get_cached_drivers(season: number): Promise<F1Driver[] | null> {
  await ensure_f1_schema();
  const db = get_client();

  const result = await db.execute({
    sql: 'SELECT * FROM f1_drivers WHERE season = ? ORDER BY family_name ASC',
    args: [season],
  });

  if (result.rows.length === 0) return null;

  return result.rows.map(row => ({
    driver_id: row.driver_id as string,
    code: row.code as string,
    given_name: row.given_name as string,
    family_name: row.family_name as string,
    constructor_id: row.constructor_id as string,
    constructor_name: row.constructor_name as string,
  }));
}

export async function save_drivers(season: number, drivers: F1Driver[]): Promise<void> {
  await ensure_f1_schema();
  const db = get_client();

  for (const d of drivers) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO f1_drivers
            (season, driver_id, code, given_name, family_name, constructor_name, constructor_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [season, d.driver_id, d.code, d.given_name, d.family_name, d.constructor_name, d.constructor_id],
    });
  }
}

// ΓöÇΓöÇ Session Results CRUD ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export async function get_cached_results(
  season: number, round: number, session_type: SessionType
): Promise<F1SessionResult | null> {
  await ensure_f1_schema();
  const db = get_client();

  const id = session_id(season, round, session_type);
  const result = await db.execute({
    sql: 'SELECT * FROM f1_sessions WHERE id = ?',
    args: [id],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    season: row.season as number,
    round: row.round as number,
    session_type: row.session_type as SessionType,
    race_name: '', // not stored separately, caller can join with schedule
    results: JSON.parse(row.results_json as string) as F1DriverResult[],
    fastest_lap_driver_id: (row.fastest_lap_driver_id as string) || null,
  };
}

export async function save_results(
  result: F1SessionResult,
  source: string = 'jolpica'
): Promise<void> {
  await ensure_f1_schema();
  const db = get_client();

  const id = session_id(result.season, result.round, result.session_type);
  await db.execute({
    sql: `INSERT OR IGNORE INTO f1_sessions
          (id, season, round, session_type, results_json, fastest_lap_driver_id, source)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, result.season, result.round, result.session_type,
      JSON.stringify(result.results),
      result.fastest_lap_driver_id, source,
    ],
  });
}

// ΓöÇΓöÇ Predictions CRUD ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export async function get_prediction(
  season: number, round: number, session_type: SessionType, player_name: string
): Promise<F1Prediction | null> {
  await ensure_f1_schema();
  const db = get_client();

  const result = await db.execute({
    sql: `SELECT * FROM f1_predictions
          WHERE season = ? AND round = ? AND session_type = ? AND player_name = ?`,
    args: [season, round, session_type, player_name],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    season: row.season as number,
    round: row.round as number,
    session_type: row.session_type as SessionType,
    player_name: row.player_name as string,
    p1: row.p1 as string,
    p2: row.p2 as string,
    p3: row.p3 as string,
    fastest_lap: (row.fastest_lap as string) || null,
    created_at: row.created_at as string,
  };
}

export async function save_prediction(
  season: number, round: number, session_type: SessionType,
  player_name: string, p1: string, p2: string, p3: string,
  fastest_lap: string | null
): Promise<string> {
  await ensure_f1_schema();
  const db = get_client();

  const id = generate_id();
  await db.execute({
    sql: `INSERT INTO f1_predictions
          (id, season, round, session_type, player_name, p1, p2, p3, fastest_lap)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, season, round, session_type, player_name, p1, p2, p3, fastest_lap],
  });

  return id;
}

export async function get_predictions_for_session(
  season: number, round: number, session_type: SessionType
): Promise<F1Prediction[]> {
  await ensure_f1_schema();
  const db = get_client();

  const result = await db.execute({
    sql: `SELECT * FROM f1_predictions
          WHERE season = ? AND round = ? AND session_type = ?`,
    args: [season, round, session_type],
  });

  return result.rows.map(row => ({
    id: row.id as string,
    season: row.season as number,
    round: row.round as number,
    session_type: row.session_type as SessionType,
    player_name: row.player_name as string,
    p1: row.p1 as string,
    p2: row.p2 as string,
    p3: row.p3 as string,
    fastest_lap: (row.fastest_lap as string) || null,
    created_at: row.created_at as string,
  }));
}

// ΓöÇΓöÇ Scores CRUD ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export async function get_score(prediction_id: string): Promise<F1Score | null> {
  await ensure_f1_schema();
  const db = get_client();

  const result = await db.execute({
    sql: 'SELECT * FROM f1_scores WHERE prediction_id = ?',
    args: [prediction_id],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    prediction_id: row.prediction_id as string,
    perfect_match: row.perfect_match as number,
    podium_lock: row.podium_lock as number,
    almost: row.almost as number,
    fastest_lap: row.fastest_lap as number,
    total: row.total as number,
    computed_at: row.computed_at as string,
  };
}

export async function save_score(score: F1Score): Promise<void> {
  await ensure_f1_schema();
  const db = get_client();

  await db.execute({
    sql: `INSERT OR REPLACE INTO f1_scores
          (prediction_id, perfect_match, podium_lock, almost, fastest_lap, total)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      score.prediction_id, score.perfect_match, score.podium_lock,
      score.almost, score.fastest_lap, score.total,
    ],
  });
}

// ΓöÇΓöÇ Player State CRUD ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export async function get_player_state(
  season: number, round: number, session_type: SessionType, player_name: string
): Promise<F1PlayerState | null> {
  await ensure_f1_schema();
  const db = get_client();

  const result = await db.execute({
    sql: `SELECT * FROM f1_player_state
          WHERE season = ? AND round = ? AND session_type = ? AND player_name = ?`,
    args: [season, round, session_type, player_name],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    season: row.season as number,
    round: row.round as number,
    session_type: row.session_type as SessionType,
    player_name: row.player_name as string,
    state: row.state as PlayerState,
    updated_at: row.updated_at as string,
  };
}

export async function set_player_state(
  season: number, round: number, session_type: SessionType,
  player_name: string, state: PlayerState
): Promise<void> {
  await ensure_f1_schema();
  const db = get_client();

  await db.execute({
    sql: `INSERT INTO f1_player_state (season, round, session_type, player_name, state, updated_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(season, round, session_type, player_name)
          DO UPDATE SET state = excluded.state, updated_at = CURRENT_TIMESTAMP`,
    args: [season, round, session_type, player_name, state],
  });
}

export async function get_player_round_states(
  season: number, round: number, player_name: string
): Promise<F1PlayerState[]> {
  await ensure_f1_schema();
  const db = get_client();

  const result = await db.execute({
    sql: `SELECT * FROM f1_player_state
          WHERE season = ? AND round = ? AND player_name = ?
          ORDER BY session_type ASC`,
    args: [season, round, player_name],
  });

  return result.rows.map(row => ({
    season: row.season as number,
    round: row.round as number,
    session_type: row.session_type as SessionType,
    player_name: row.player_name as string,
    state: row.state as PlayerState,
    updated_at: row.updated_at as string,
  }));
}

// —— Roster CRUD ——————————————————————————————————————

export async function get_roster(season: number): Promise<string[]> {
  await ensure_f1_schema();
  const db = get_client();

  const result = await db.execute({
    sql: 'SELECT player_name FROM f1_roster WHERE season = ? ORDER BY player_name ASC',
    args: [season],
  });

  return result.rows.map(row => row.player_name as string);
}

export async function add_to_roster(season: number, player_name: string): Promise<void> {
  await ensure_f1_schema();
  const db = get_client();

  await db.execute({
    sql: 'INSERT OR IGNORE INTO f1_roster (season, player_name) VALUES (?, ?)',
    args: [season, player_name],
  });
}

export async function remove_from_roster(season: number, player_name: string): Promise<void> {
  await ensure_f1_schema();
  const db = get_client();

  await db.execute({
    sql: 'DELETE FROM f1_roster WHERE season = ? AND player_name = ?',
    args: [season, player_name],
  });
}

export async function get_all_player_states_for_round(
  season: number, round: number
): Promise<F1PlayerState[]> {
  await ensure_f1_schema();
  const db = get_client();

  const result = await db.execute({
    sql: `SELECT * FROM f1_player_state
          WHERE season = ? AND round = ?
          ORDER BY player_name ASC, session_type ASC`,
    args: [season, round],
  });

  return result.rows.map(row => ({
    season: row.season as number,
    round: row.round as number,
    session_type: row.session_type as SessionType,
    player_name: row.player_name as string,
    state: row.state as PlayerState,
    updated_at: row.updated_at as string,
  }));
}

// —— Season Reset ————————————————————————————————————

export async function reset_season_data(season: number): Promise<{ predictions: number; scores: number; states: number }> {
  await ensure_f1_schema();
  const db = get_client();

  // Delete scores for this season's predictions
  const score_result = await db.execute({
    sql: `DELETE FROM f1_scores WHERE prediction_id IN (SELECT id FROM f1_predictions WHERE season = ?)`,
    args: [season],
  });

  // Delete predictions
  const pred_result = await db.execute({
    sql: 'DELETE FROM f1_predictions WHERE season = ?',
    args: [season],
  });

  // Delete player states
  const state_result = await db.execute({
    sql: 'DELETE FROM f1_player_state WHERE season = ?',
    args: [season],
  });

  return {
    predictions: pred_result.rowsAffected,
    scores: score_result.rowsAffected,
    states: state_result.rowsAffected,
  };
}

// —— Leaderboard Query ———————————————————————————————

export interface LeaderboardEntry {
  player_name: string;
  total_score: number;
  sessions_played: number;
}

export async function get_leaderboard(season: number): Promise<LeaderboardEntry[]> {
  await ensure_f1_schema();
  const db = get_client();

  const result = await db.execute({
    sql: `SELECT p.player_name, COALESCE(SUM(s.total), 0) as total_score, COUNT(s.prediction_id) as sessions_played
          FROM f1_predictions p
          LEFT JOIN f1_scores s ON p.id = s.prediction_id
          WHERE p.season = ?
          GROUP BY p.player_name
          ORDER BY total_score DESC`,
    args: [season],
  });

  return result.rows.map(row => ({
    player_name: row.player_name as string,
    total_score: (row.total_score as number) || 0,
    sessions_played: (row.sessions_played as number) || 0,
  }));
}
