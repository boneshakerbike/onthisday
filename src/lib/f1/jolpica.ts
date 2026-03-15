/**
 * Jolpica-F1 API Adapter
 * Drop-in Ergast replacement: https://api.jolpi.ca/ergast/f1/
 * Free, no auth, 4 req/sec, JSON only.
 */

import type {
  F1DataAdapter, F1RaceSchedule, F1Driver, F1SessionResult,
  F1DriverResult, SessionType,
} from './types';

const BASE = 'https://api.jolpi.ca/ergast/f1';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function jolpica_fetch(path: string): Promise<any> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 0 }, // no Next.js cache
  });

  if (!res.ok) {
    throw new Error(`Jolpica API error: ${res.status} ${res.statusText} for ${url}`);
  }

  const data = await res.json();
  return data.MRData;
}

export class JolpicaAdapter implements F1DataAdapter {

  async fetch_schedule(season: number): Promise<F1RaceSchedule[]> {
    const data = await jolpica_fetch(`/${season}.json?limit=30`);
    const races = data.RaceTable?.Races || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return races.map((race: any) => ({
      season,
      round: parseInt(race.round, 10),
      race_name: race.raceName,
      circuit_id: race.Circuit?.circuitId || '',
      circuit_name: race.Circuit?.circuitName || '',
      country: race.Circuit?.Location?.country || '',
      locality: race.Circuit?.Location?.locality || '',
      race_date: race.date || '',
      race_time: race.time || null,
      // Sprint weekends have a Sprint object in the schedule
      is_sprint_weekend: !!race.Sprint,
    }));
  }

  async fetch_drivers(season: number): Promise<F1Driver[]> {
    const data = await jolpica_fetch(`/${season}/drivers.json?limit=50`);
    const drivers = data.DriverTable?.Drivers || [];

    // Jolpica drivers endpoint doesn't include constructor.
    // Fetch from standings which has constructor info.
    let constructor_map: Map<string, { id: string; name: string }> = new Map();
    try {
      const standings_data = await jolpica_fetch(`/${season}/driverStandings.json`);
      const standings = standings_data.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
      for (const entry of standings) {
        const constructors = entry.Constructors || [];
        if (constructors.length > 0) {
          constructor_map.set(entry.Driver.driverId, {
            id: constructors[constructors.length - 1].constructorId,
            name: constructors[constructors.length - 1].name,
          });
        }
      }
    } catch {
      // Standings may not be available yet for future seasons
      constructor_map = new Map();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return drivers.map((d: any) => {
      const constructor = constructor_map.get(d.driverId);
      return {
        driver_id: d.driverId,
        code: d.code || d.driverId.substring(0, 3).toUpperCase(),
        given_name: d.givenName,
        family_name: d.familyName,
        constructor_id: constructor?.id || 'unknown',
        constructor_name: constructor?.name || 'Unknown',
      };
    });
  }

  async fetch_results(
    season: number, round: number, session_type: SessionType
  ): Promise<F1SessionResult> {
    // Sprint qualifying uses sprint results sorted by grid position (starting order = SQ finishing order)
    const endpoint = session_type === 'qualifying'
      ? `/${season}/${round}/qualifying.json`
      : session_type === 'sprint' || session_type === 'sprint_qualifying'
        ? `/${season}/${round}/sprint.json`
        : `/${season}/${round}/results.json`;

    const data = await jolpica_fetch(endpoint);
    const race = data.RaceTable?.Races?.[0];

    if (!race) {
      throw new Error(`No results found for ${season} round ${round} ${session_type}`);
    }

    if (session_type === 'sprint_qualifying') {
      const sprint_results = race.SprintResults || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sorted_by_grid = [...sprint_results].sort((a: any, b: any) =>
        parseInt(a.grid || '0', 10) - parseInt(b.grid || '0', 10)
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: F1DriverResult[] = sorted_by_grid.map((r: any, idx: number) => ({
        position: idx + 1,
        driver_id: r.Driver.driverId,
        driver_code: r.Driver.code || r.Driver.driverId.substring(0, 3).toUpperCase(),
        given_name: r.Driver.givenName,
        family_name: r.Driver.familyName,
        constructor_id: r.Constructor?.constructorId || '',
        constructor_name: r.Constructor?.name || '',
        grid: parseInt(r.grid || '0', 10),
        laps: 0,
        status: 'Finished',
        time_text: null,
        fastest_lap_rank: null,
      }));
      return {
        season, round, session_type: 'sprint_qualifying' as SessionType,
        race_name: race.raceName, results, fastest_lap_driver_id: null,
      };
    }

    const raw_results = session_type === 'qualifying'
      ? race.QualifyingResults || []
      : session_type === 'sprint'
        ? race.SprintResults || []
        : race.Results || [];

    // Find fastest lap holder for race results
    let fastest_lap_driver_id: string | null = null;
    if (session_type === 'race') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fl = raw_results.find((r: any) => r.FastestLap?.rank === '1');
      if (fl) fastest_lap_driver_id = fl.Driver.driverId;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: F1DriverResult[] = raw_results.map((r: any) => {
      let time_text: string | null = null;

      if (session_type === 'qualifying') {
        // Best qualifying time: Q3 > Q2 > Q1
        time_text = r.Q3 || r.Q2 || r.Q1 || null;
      } else {
        // Race/Sprint: winner gets absolute time, others get gap
        time_text = r.Time?.time || r.status || null;
      }

      return {
        position: parseInt(r.position, 10),
        driver_id: r.Driver.driverId,
        driver_code: r.Driver.code || r.Driver.driverId.substring(0, 3).toUpperCase(),
        given_name: r.Driver.givenName,
        family_name: r.Driver.familyName,
        constructor_id: r.Constructor?.constructorId || '',
        constructor_name: r.Constructor?.name || '',
        grid: parseInt(r.grid || '0', 10),
        laps: parseInt(r.laps || '0', 10),
        status: r.status || 'Finished',
        time_text,
        fastest_lap_rank: r.FastestLap?.rank ? parseInt(r.FastestLap.rank, 10) : null,
      };
    });

    return {
      season,
      round,
      session_type,
      race_name: race.raceName,
      results,
      fastest_lap_driver_id,
    };
  }
}
