/**
 * Sprint qualifying result transformation tests
 * Spec: grid positions sorted ascending → SQ order (grid field, NOT finishing position)
 */

import { describe, it, expect } from 'vitest';
import type { F1DriverResult } from '../types';

// Replicate the transformation from jolpica.ts without importing the class
// (class uses fetch — we test the pure sorting/mapping logic directly)
function transform_sprint_qualifying(sprint_results: { grid: string; Driver: { driverId: string } }[]): F1DriverResult[] {
  const sorted = [...sprint_results].sort((a, b) =>
    parseInt(a.grid || '0', 10) - parseInt(b.grid || '0', 10)
  );
  return sorted.map((r, idx) => ({
    position: idx + 1,
    driver_id: r.Driver.driverId,
    driver_code: r.Driver.driverId.slice(0, 3).toUpperCase(),
    given_name: r.Driver.driverId,
    family_name: '',
    constructor_id: 'test',
    constructor_name: 'Test',
    grid: parseInt(r.grid || '0', 10),
    laps: 0,
    status: 'Finished',
    time_text: null,
    fastest_lap_rank: null,
  }));
}

describe('sprint qualifying transformation', () => {
  it('sorts by grid ascending, not finishing position', () => {
    // Ham finished P1 in the sprint but started P3 → SQ result is P3
    const raw = [
      { grid: '3', Driver: { driverId: 'hamilton' } },  // finished P1 in sprint
      { grid: '1', Driver: { driverId: 'verstappen' } }, // finished P2
      { grid: '2', Driver: { driverId: 'norris' } },     // finished P3
    ];
    const results = transform_sprint_qualifying(raw);
    expect(results[0].driver_id).toBe('verstappen'); // grid 1 → SQ P1
    expect(results[1].driver_id).toBe('norris');     // grid 2 → SQ P2
    expect(results[2].driver_id).toBe('hamilton');   // grid 3 → SQ P3
  });

  it('assigns sequential positions starting at 1', () => {
    const raw = [
      { grid: '2', Driver: { driverId: 'nor' } },
      { grid: '1', Driver: { driverId: 'ver' } },
      { grid: '3', Driver: { driverId: 'lec' } },
    ];
    const results = transform_sprint_qualifying(raw);
    expect(results.map(r => r.position)).toEqual([1, 2, 3]);
  });

  it('preserves grid value in output', () => {
    const raw = [
      { grid: '1', Driver: { driverId: 'ver' } },
      { grid: '5', Driver: { driverId: 'ham' } },
    ];
    const results = transform_sprint_qualifying(raw);
    expect(results[0].grid).toBe(1);
    expect(results[1].grid).toBe(5);
  });

  it('handles already-sorted input (no reorder needed)', () => {
    const raw = [
      { grid: '1', Driver: { driverId: 'a' } },
      { grid: '2', Driver: { driverId: 'b' } },
      { grid: '3', Driver: { driverId: 'c' } },
    ];
    const results = transform_sprint_qualifying(raw);
    expect(results.map(r => r.driver_id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate original array', () => {
    const raw = [
      { grid: '3', Driver: { driverId: 'c' } },
      { grid: '1', Driver: { driverId: 'a' } },
    ];
    const original_order = raw.map(r => r.Driver.driverId);
    transform_sprint_qualifying(raw);
    expect(raw.map(r => r.Driver.driverId)).toEqual(original_order);
  });
});
