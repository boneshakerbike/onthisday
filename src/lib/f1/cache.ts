/**
 * F1 Cache-Through Layer
 * DB first, adapter second. Fetch once, store forever.
 * Also contains the scoring logic.
 */

import { get_f1_adapter } from './adapter';
import {
  get_cached_schedule, save_schedule,
  get_cached_drivers, save_drivers,
  get_cached_results, save_results,
  get_prediction, get_predictions_for_session,
  get_score, save_score,
  set_player_state,
} from './db';
import type {
  F1RaceSchedule, F1Driver, F1SessionResult,
  F1Prediction, F1Score, SessionType,
} from './types';
import { POINTS } from './types';

// ΓöÇΓöÇ Schedule (lazy fetch, cache forever) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export async function get_schedule(season: number): Promise<F1RaceSchedule[]> {
  const cached = await get_cached_schedule(season);
  if (cached) return cached;

  const adapter = get_f1_adapter();
  const races = await adapter.fetch_schedule(season);
  await save_schedule(races);
  return races;
}

// ΓöÇΓöÇ Drivers (lazy fetch, cache forever) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export async function get_drivers(season: number): Promise<F1Driver[]> {
  const cached = await get_cached_drivers(season);
  if (cached) return cached;

  const adapter = get_f1_adapter();
  const drivers = await adapter.fetch_drivers(season);
  await save_drivers(season, drivers);
  return drivers;
}

// ΓöÇΓöÇ Results (fetch on reveal only, cache forever) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export async function get_or_fetch_results(
  season: number, round: number, session_type: SessionType
): Promise<F1SessionResult> {
  const cached = await get_cached_results(season, round, session_type);
  if (cached) return cached;

  const adapter = get_f1_adapter();
  const result = await adapter.fetch_results(season, round, session_type);
  await save_results(result);
  return result;
}

export async function get_results_if_cached(
  season: number, round: number, session_type: SessionType
): Promise<F1SessionResult | null> {
  return get_cached_results(season, round, session_type);
}

// ΓöÇΓöÇ Scoring ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export function compute_score(
  prediction: F1Prediction,
  results: F1SessionResult
): F1Score {
  const actual_podium = results.results.slice(0, 3).map(r => r.driver_id);
  const actual_p4_p5 = results.results.slice(3, 5).map(r => r.driver_id);
  const predicted = [prediction.p1, prediction.p2, prediction.p3];

  let perfect_match = 0;
  let podium_lock = 0;
  let almost = 0;

  for (let i = 0; i < 3; i++) {
    const pick = predicted[i];
    if (pick === actual_podium[i]) {
      perfect_match++;
    } else if (actual_podium.includes(pick)) {
      podium_lock++;
    } else if (actual_p4_p5.includes(pick)) {
      almost++;
    }
  }

  let fastest_lap = 0;
  if (
    prediction.session_type === 'race' &&
    prediction.fastest_lap &&
    results.fastest_lap_driver_id === prediction.fastest_lap
  ) {
    fastest_lap = POINTS.fastest_lap;
  }

  const total =
    perfect_match * POINTS.perfect_match +
    podium_lock * POINTS.podium_lock +
    almost * POINTS.almost +
    fastest_lap;

  return {
    prediction_id: prediction.id,
    perfect_match,
    podium_lock,
    almost,
    fastest_lap,
    total,
    computed_at: new Date().toISOString(),
  };
}

// ΓöÇΓöÇ Reveal Flow (fetch + score all predictions) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export async function reveal_session(
  season: number, round: number, session_type: SessionType, player_name: string
): Promise<{
  results: F1SessionResult;
  prediction: F1Prediction | null;
  score: F1Score | null;
}> {
  // 1. Fetch results (cache-through ΓÇö only hits API if not cached)
  const results = await get_or_fetch_results(season, round, session_type);

  // 2. Get this player's prediction
  const prediction = await get_prediction(season, round, session_type, player_name);

  let score: F1Score | null = null;

  if (prediction) {
    // 3. Check if already scored
    const existing_score = await get_score(prediction.id);
    if (existing_score) {
      score = existing_score;
    } else {
      // 4. Compute and save score
      score = compute_score(prediction, results);
      await save_score(score);
    }
  }

  // 5. Update player state to revealed
  await set_player_state(season, round, session_type, player_name, 'revealed');

  // 6. Score any other predictions for this session that haven't been scored yet
  const all_predictions = await get_predictions_for_session(season, round, session_type);
  for (const pred of all_predictions) {
    const existing = await get_score(pred.id);
    if (!existing) {
      const pred_score = compute_score(pred, results);
      await save_score(pred_score);
    }
  }

  return { results, prediction, score };
}
