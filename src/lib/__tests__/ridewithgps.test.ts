import { describe, it, expect } from 'vitest';
import { trip_to_activity, rwgps_activity_date_str, type RwgpsTripSummary } from '../ridewithgps';

describe('trip_to_activity', () => {
  it('maps a normal GPS trip', () => {
    const trip: RwgpsTripSummary = {
      id: 123,
      name: 'Evening gravel loop',
      activity_type: 'Gravel Cycling',
      distance: 9500,
      duration: 1800,
      moving_time: 1750,
      elevation_gain: 145,
      avg_hr: 132,
      max_hr: 168,
      departed_at: '2026-07-13T18:00:00Z',
      web_url: 'https://ridewithgps.com/trips/123',
    };
    const activity = trip_to_activity(trip);
    expect(activity).toMatchObject({
      id: 123,
      name: 'Evening gravel loop',
      type: 'Gravel Cycling',
      distance: 9500,
      moving_time: 1750,
      total_elevation_gain: 145,
      average_heartrate: 132,
      max_heartrate: 168,
      url: 'https://ridewithgps.com/trips/123',
    });
  });

  it('falls back to duration when moving_time is missing for a stationary trip', () => {
    const trip: RwgpsTripSummary = {
      id: 456,
      name: 'Strength session',
      activity_type: 'Strength Training',
      distance: 0,
      duration: 2700,
      moving_time: 0,
      elevation_gain: 0,
      stationary: true,
    };
    const activity = trip_to_activity(trip);
    expect(activity.moving_time).toBe(2700);
    expect(activity.distance).toBe(0);
  });

  it('falls back to duration when moving_time is null', () => {
    const trip: RwgpsTripSummary = { id: 1, duration: 900, moving_time: null };
    expect(trip_to_activity(trip).moving_time).toBe(900);
  });

  it('handles missing optional fields without throwing', () => {
    const trip: RwgpsTripSummary = { id: 789 };
    const activity = trip_to_activity(trip);
    expect(activity).toMatchObject({
      id: 789,
      name: 'Activity',
      type: 'Activity',
      distance: 0,
      moving_time: 0,
      total_elevation_gain: 0,
    });
    expect(activity.average_heartrate).toBeUndefined();
    expect(activity.max_heartrate).toBeUndefined();
  });

  it('constructs a trip URL from the id when web_url is absent (confirmed against live data — trips.json never returns it)', () => {
    const trip: RwgpsTripSummary = { id: 399118168 };
    expect(trip_to_activity(trip).url).toBe('https://ridewithgps.com/trips/399118168');
  });

  it('prefers web_url over the constructed URL when present', () => {
    const trip: RwgpsTripSummary = { id: 1, web_url: 'https://ridewithgps.com/trips/1?privacy_code=abc' };
    expect(trip_to_activity(trip).url).toBe('https://ridewithgps.com/trips/1?privacy_code=abc');
  });

  it('falls back to fit_sport when activity_type is absent', () => {
    const trip: RwgpsTripSummary = { id: 1, activity_type: null, fit_sport: 2 };
    expect(trip_to_activity(trip).type).toBe('2');
  });
});

describe('rwgps_activity_date_str', () => {
  it('converts a UTC (Z-suffixed) instant to its Mountain Time calendar date', () => {
    // 2026-07-10 01:00 UTC = 2026-07-09 19:00 MDT (UTC-6)
    expect(rwgps_activity_date_str('2026-07-10T01:00:00Z')).toBe('2026-07-09');
  });

  it('converts an offset-suffixed instant to its Mountain Time calendar date', () => {
    expect(rwgps_activity_date_str('2026-07-10T01:00:00+00:00')).toBe('2026-07-09');
  });

  it('treats a naive (no offset) string as already-local and reads the date directly', () => {
    expect(rwgps_activity_date_str('2026-07-13T18:00:00')).toBe('2026-07-13');
  });
});
