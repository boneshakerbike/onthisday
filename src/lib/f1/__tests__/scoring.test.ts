/**
 * Scoring logic tests — compute_score()
 * Spec: POINTS = { perfect_match: 5, podium_lock: 2, almost: 1, fastest_lap: 3 }
 */

import { describe, it, expect } from 'vitest';
import { compute_score } from '../cache';
import { POINTS } from '../types';
import type { F1Prediction, F1SessionResult } from '../types';

// ── Helpers ─────────────────────────────────────────────────────────────────

function make_prediction(overrides: Partial<F1Prediction> = {}): F1Prediction {
  return {
    id: 'test-pred',
    season: 2026,
    round: 1,
    session_type: 'race',
    player_name: 'Bill',
    p1: 'verstappen',
    p2: 'norris',
    p3: 'leclerc',
    fastest_lap: null,
    is_locked: true,
    created_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

function make_results(top5: string[], fl: string | null = null): F1SessionResult {
  return {
    season: 2026,
    round: 1,
    session_type: 'race',
    race_name: 'Test GP',
    fastest_lap_driver_id: fl,
    results: top5.map((driver_id, i) => ({
      position: i + 1,
      driver_id,
      driver_code: driver_id.slice(0, 3).toUpperCase(),
      given_name: driver_id,
      family_name: '',
      constructor_id: 'test',
      constructor_name: 'Test Team',
      grid: i + 1,
      laps: 57,
      status: 'Finished',
      time_text: null,
      fastest_lap_rank: null,
    })),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('compute_score — perfect match', () => {
  it('P1 exact match → 5 pts', () => {
    const pred = make_prediction({ p1: 'ver', p2: 'nor', p3: 'lec', fastest_lap: null });
    const results = make_results(['ver', 'nor', 'lec', 'pia', 'ham']);
    const score = compute_score(pred, results);
    expect(score.perfect_match).toBe(3);
    expect(score.total).toBe(3 * POINTS.perfect_match);
  });

  it('only P1 exact, P2 and P3 miss → 5 pts', () => {
    const pred = make_prediction({ p1: 'ver', p2: 'zzz', p3: 'zzz' });
    const results = make_results(['ver', 'nor', 'lec', 'pia', 'ham']);
    const score = compute_score(pred, results);
    expect(score.perfect_match).toBe(1);
    expect(score.podium_lock).toBe(0);
    expect(score.total).toBe(POINTS.perfect_match);
  });
});

describe('compute_score — podium lock', () => {
  it('predicted P1 finishes P3 → podium_lock', () => {
    const pred = make_prediction({ p1: 'lec', p2: 'zzz', p3: 'zzz' });
    const results = make_results(['ver', 'nor', 'lec', 'pia', 'ham']);
    const score = compute_score(pred, results);
    expect(score.podium_lock).toBe(1);
    expect(score.total).toBe(POINTS.podium_lock);
  });

  it('predicted P2 finishes P1 → podium_lock', () => {
    const pred = make_prediction({ p1: 'zzz', p2: 'ver', p3: 'zzz' });
    const results = make_results(['ver', 'nor', 'lec', 'pia', 'ham']);
    const score = compute_score(pred, results);
    expect(score.podium_lock).toBe(1);
  });
});

describe('compute_score — almost', () => {
  it('predicted P1, driver finishes P4 → 1 pt', () => {
    const pred = make_prediction({ p1: 'pia', p2: 'zzz', p3: 'zzz' });
    const results = make_results(['ver', 'nor', 'lec', 'pia', 'ham']);
    const score = compute_score(pred, results);
    expect(score.almost).toBe(1);
    expect(score.total).toBe(POINTS.almost);
  });

  it('predicted P1, driver finishes P5 → 1 pt', () => {
    const pred = make_prediction({ p1: 'ham', p2: 'zzz', p3: 'zzz' });
    const results = make_results(['ver', 'nor', 'lec', 'pia', 'ham']);
    const score = compute_score(pred, results);
    expect(score.almost).toBe(1);
    expect(score.total).toBe(POINTS.almost);
  });

  it('predicted P1, driver finishes P6 → 0 pts', () => {
    const pred = make_prediction({ p1: 'sai', p2: 'zzz', p3: 'zzz' });
    const results = make_results(['ver', 'nor', 'lec', 'pia', 'ham', 'sai']);
    const score = compute_score(pred, results);
    expect(score.almost).toBe(0);
    expect(score.total).toBe(0);
  });
});

describe('compute_score — fastest lap', () => {
  it('correct FL pick on race → +3 pts', () => {
    const pred = make_prediction({ p1: 'ver', p2: 'nor', p3: 'lec', fastest_lap: 'ver' });
    const results = make_results(['ver', 'nor', 'lec', 'pia', 'ham'], 'ver');
    const score = compute_score(pred, results);
    expect(score.fastest_lap).toBe(POINTS.fastest_lap);
    expect(score.total).toBe(3 * POINTS.perfect_match + POINTS.fastest_lap);
  });

  it('wrong FL pick on race → 0 FL pts', () => {
    const pred = make_prediction({ fastest_lap: 'nor' });
    const results = make_results(['ver', 'nor', 'lec', 'pia', 'ham'], 'ver');
    const score = compute_score(pred, results);
    expect(score.fastest_lap).toBe(0);
  });

  it('FL pick on qualifying → no bonus (session_type guard)', () => {
    const pred = make_prediction({ session_type: 'qualifying', fastest_lap: 'ver' });
    const results = { ...make_results(['ver', 'nor', 'lec', 'pia', 'ham'], 'ver'), session_type: 'qualifying' as const };
    const score = compute_score(pred, results);
    expect(score.fastest_lap).toBe(0);
  });

  it('FL pick on sprint → no bonus', () => {
    const pred = make_prediction({ session_type: 'sprint', fastest_lap: 'ver' });
    const results = { ...make_results(['ver', 'nor', 'lec', 'pia', 'ham'], 'ver'), session_type: 'sprint' as const };
    const score = compute_score(pred, results);
    expect(score.fastest_lap).toBe(0);
  });

  it('FL pick on sprint_qualifying → no bonus', () => {
    const pred = make_prediction({ session_type: 'sprint_qualifying', fastest_lap: 'ver' });
    const results = { ...make_results(['ver', 'nor', 'lec', 'pia', 'ham'], 'ver'), session_type: 'sprint_qualifying' as const };
    const score = compute_score(pred, results);
    expect(score.fastest_lap).toBe(0);
  });
});

describe('compute_score — max and zero scenarios', () => {
  it('max score: 3 perfect matches + correct FL = 18 pts', () => {
    const pred = make_prediction({ p1: 'ver', p2: 'nor', p3: 'lec', fastest_lap: 'ver' });
    const results = make_results(['ver', 'nor', 'lec', 'pia', 'ham'], 'ver');
    const score = compute_score(pred, results);
    expect(score.total).toBe(18);
    expect(score.perfect_match).toBe(3);
    expect(score.fastest_lap).toBe(3);
  });

  it('zero score: all misses, no FL', () => {
    const pred = make_prediction({ p1: 'zzz1', p2: 'zzz2', p3: 'zzz3', fastest_lap: null });
    const results = make_results(['ver', 'nor', 'lec', 'pia', 'ham']);
    const score = compute_score(pred, results);
    expect(score.total).toBe(0);
    expect(score.perfect_match).toBe(0);
    expect(score.podium_lock).toBe(0);
    expect(score.almost).toBe(0);
    expect(score.fastest_lap).toBe(0);
  });

  it('score carries correct prediction_id', () => {
    const pred = make_prediction({ id: 'my-pred-id' });
    const results = make_results(['ver', 'nor', 'lec', 'pia', 'ham']);
    const score = compute_score(pred, results);
    expect(score.prediction_id).toBe('my-pred-id');
  });
});
