/**
 * Ride with GPS trip → coaching-pipeline activity adapter.
 * Pure, testable mapping — no network calls here (those live in the API route).
 */

import { mt_date_str } from './coaching/day';

export interface RwgpsTripSummary {
  id: number;
  name?: string | null;
  activity_type?: string | null;
  fit_sport?: number | null;
  distance?: number | null;      // meters
  duration?: number | null;      // seconds
  moving_time?: number | null;   // seconds
  elevation_gain?: number | null; // meters
  avg_hr?: number | null;
  max_hr?: number | null;
  departed_at?: string | null;   // ISO date-time, format TBD — see rwgps_activity_date_str
  time_zone?: string | null;
  stationary?: boolean;
  web_url?: string | null;
}

export interface RwgpsActivity {
  id?: number;
  name: string;
  type: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
  average_heartrate?: number;
  max_heartrate?: number;
  url?: string;
  departed_at?: string;
}

export function trip_to_activity(trip: RwgpsTripSummary): RwgpsActivity {
  return {
    id: trip.id,
    name: trip.name || 'Activity',
    type: trip.activity_type || (trip.fit_sport != null ? String(trip.fit_sport) : 'Activity'),
    distance: trip.distance ?? 0,
    // Stationary trips (e.g. Strength Training) have no GPS track, so moving_time
    // is often 0/null even though duration correctly holds the workout length.
    moving_time: trip.moving_time || trip.duration || 0,
    total_elevation_gain: trip.elevation_gain ?? 0,
    average_heartrate: trip.avg_hr ?? undefined,
    max_heartrate: trip.max_hr ?? undefined,
    url: trip.web_url ?? undefined,
    departed_at: trip.departed_at ?? undefined,
  };
}

const OFFSET_MARKER = /Z$|[+-]\d{2}:\d{2}$/;

/**
 * Mountain-Time calendar date (YYYY-MM-DD) for a trip's departed_at.
 * If the string carries an explicit UTC/offset marker it's an absolute instant,
 * converted via mt_date_str. If it's naive (no marker), it's treated as already
 * local and read directly — running a naive string through `new Date()` on a
 * UTC server would silently reinterpret it in the wrong zone.
 */
export function rwgps_activity_date_str(departed_at: string): string {
  if (OFFSET_MARKER.test(departed_at)) {
    return mt_date_str(new Date(departed_at));
  }
  return departed_at.slice(0, 10);
}
