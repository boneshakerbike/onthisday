/**
 * Mr Bear — AI F1 Predictor
 * Generates picks server-side using Jolpica qualifying data + personality biases.
 * No external dependencies beyond what the app already uses.
 */

import type { SessionType } from './types';
import { get_cached_results } from './db';

const BASE = 'https://api.jolpi.ca/ergast/f1';
const VERSTAPPEN_ID = 'max_verstappen';
const BEAR_BOOST = 3;
const ROOKIE_BOOST = 2;

const ROOKIES: Record<number, string[]> = {
  2025: ['antonelli', 'bearman', 'doohan', 'hadjar', 'bortoleto'],
  2026: [],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function jolpica_fetch(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Jolpica: ${res.status} for ${path}`);
  return (await res.json()).MRData;
}

// — Driver name map (for bear-name detection) ————————

export async function get_driver_name_map(season: number): Promise<Record<string, string>> {
  const data = await jolpica_fetch(`/${season}/drivers.json?limit=50`);
  const drivers = data.DriverTable?.Drivers || [];
  const map: Record<string, string> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of drivers) {
    map[d.driverId] = `${d.givenName} ${d.familyName}`;
  }
  return map;
}

// — Bias logic ————————————————————————————————————————

export function apply_biases(
  ranking: string[], driver_names: Record<string, string>, season: number
): string[] {
  const result = ranking.filter(id => id !== VERSTAPPEN_ID);

  // Bear name boost
  for (let i = 0; i < result.length; i++) {
    const name = driver_names[result[i]] || '';
    if (name.toLowerCase().includes('bear')) {
      const new_pos = Math.max(0, i - BEAR_BOOST);
      if (new_pos !== i) {
        const [driver] = result.splice(i, 1);
        result.splice(new_pos, 0, driver);
      }
    }
  }

  // Rookie boost
  const rookies = new Set(ROOKIES[season] || []);
  for (let i = 0; i < result.length; i++) {
    if (rookies.has(result[i])) {
      const new_pos = Math.max(0, i - ROOKIE_BOOST);
      if (new_pos !== i) {
        const [driver] = result.splice(i, 1);
        result.splice(new_pos, 0, driver);
      }
    }
  }

  return result;
}

// — Qualifying ranking (average of last 3 rounds) ————

export async function get_qualifying_ranking(
  season: number, round: number
): Promise<string[]> {
  // Collect qualifying results from up to 3 prior rounds
  const position_sums: Record<string, { total: number; count: number }> = {};

  let rounds_found = 0;
  for (let r = round - 1; r >= 1 && rounds_found < 3; r--) {
    try {
      const data = await jolpica_fetch(`/${season}/${r}/qualifying.json`);
      const race = data.RaceTable?.Races?.[0];
      const results = race?.QualifyingResults || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const qr of results) {
        const id = qr.Driver.driverId;
        const pos = parseInt(qr.position, 10);
        if (!position_sums[id]) position_sums[id] = { total: 0, count: 0 };
        position_sums[id].total += pos;
        position_sums[id].count++;
      }
      rounds_found++;
    } catch {
      // Round may not have qualifying yet, skip
    }
  }

  // Round 1 fallback: previous season championship standings
  if (rounds_found === 0) {
    const prev = season - 1;
    try {
      const data = await jolpica_fetch(`/${prev}/driverStandings.json`);
      const standings = data.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return standings.map((s: any) => s.Driver.driverId as string);
    } catch {
      return [];
    }
  }

  // Sort by average position
  return Object.entries(position_sums)
    .map(([id, { total, count }]) => ({ id, avg: total / count }))
    .sort((a, b) => a.avg - b.avg)
    .map(e => e.id);
}

// — Seeded pseudo-random (LCG) ——————————————————————
// Returns a deterministic float in [0, 1) from a seed integer.

function seeded_random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// — Race ranking (qualifying grid + position noise) ——

export async function get_race_ranking(
  season: number, round: number
): Promise<string[]> {
  // Try cached qualifying results first
  const cached = await get_cached_results(season, round, 'qualifying' as SessionType);
  let base: string[];
  if (cached) {
    base = cached.results
      .sort((a, b) => a.position - b.position)
      .map(r => r.driver_id);
  } else {
    // Qualifying not revealed yet — fall back to form-based ranking
    base = await get_qualifying_ranking(season, round);
  }

  // Add position noise (±2) so race picks differ from qualifying picks.
  // Use a deterministic seed so the same round always produces the same shuffle.
  const rng = seeded_random(season * 1000 + round);
  const noisy = base.map((id, i) => ({
    id,
    score: i + (rng() * 4 - 2), // position ± up to 2
  }));
  noisy.sort((a, b) => a.score - b.score);
  return noisy.map(n => n.id);
}

// — Pick generation ———————————————————————————————————

export async function generate_picks(
  season: number, round: number, session_type: SessionType
): Promise<{ p1: string; p2: string; p3: string; fastest_lap: string | null }> {
  // Base ranking depends on session type
  const is_grid_based = session_type === 'race' || session_type === 'sprint';
  const ranking = is_grid_based
    ? await get_race_ranking(season, round)
    : await get_qualifying_ranking(season, round);

  if (ranking.length < 3) {
    throw new Error(`Not enough data to generate picks (got ${ranking.length} drivers)`);
  }

  const names = await get_driver_name_map(season);
  const biased = apply_biases(ranking, names, season);

  const picks = {
    p1: biased[0],
    p2: biased[1],
    p3: biased[2],
    fastest_lap: null as string | null,
  };

  // Fastest lap for race only: highest qualifier among biased top 10
  if (session_type === 'race') {
    const quali_ranking = await get_qualifying_ranking(season, round);
    const quali_biased = apply_biases(quali_ranking, names, season);
    const top10_race = new Set(biased.slice(0, 10));
    for (const id of quali_biased) {
      if (top10_race.has(id)) {
        picks.fastest_lap = id;
        break;
      }
    }
  }

  return picks;
}
