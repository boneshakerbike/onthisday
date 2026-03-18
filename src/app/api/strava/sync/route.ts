/**
 * API route: POST /api/strava/sync
 * Force-refreshes all Strava caches. Called by the "Refresh" button in the UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  get_strava_tokens,
  refresh_strava_access_token,
  save_strava_athlete_cache,
  save_strava_activities_cache,
} from '@/lib/db';

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request });
  const pin_header = request.headers.get('X-Guest-Pin');
  const valid_pins = (process.env.GUEST_PINS || process.env.GUEST_PIN || '')
    .split(',').map(p => p.trim()).filter(Boolean);

  if (!token && (!pin_header || !valid_pins.includes(pin_header))) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    let tokens = await get_strava_tokens();
    if (!tokens) {
      return NextResponse.json({ error: 'Strava not connected' }, { status: 404 });
    }

    if (tokens.expires_at < Math.floor(Date.now() / 1000) + 60) {
      tokens = await refresh_strava_access_token();
    }

    const headers = { 'Authorization': `Bearer ${tokens.access_token}` };

    const [athlete_res, stats_res, activities_res] = await Promise.allSettled([
      fetch('https://www.strava.com/api/v3/athlete', { headers }),
      fetch(`https://www.strava.com/api/v3/athletes/${tokens.athlete_id}/stats`, { headers }),
      fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', { headers }),
    ]);

    const fetched_at = new Date().toISOString();

    const athlete = athlete_res.status === 'fulfilled' && athlete_res.value.ok
      ? await athlete_res.value.json() : {};
    const stats = stats_res.status === 'fulfilled' && stats_res.value.ok
      ? await stats_res.value.json() : {};
    const activities_raw = activities_res.status === 'fulfilled' && activities_res.value.ok
      ? await activities_res.value.json() : [];

    await Promise.allSettled([
      save_strava_athlete_cache({ athlete, stats, fetched_at }),
      save_strava_activities_cache({ activities: Array.isArray(activities_raw) ? activities_raw : [], fetched_at }),
    ]);

    return NextResponse.json({ success: true, refreshed_at: fetched_at });

  } catch (error) {
    console.error('Strava sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
