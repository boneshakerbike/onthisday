/**
 * API route: GET /api/strava/data
 * Returns cached athlete profile, stats, and recent activities.
 * Cache TTL: 1 hour. Use ?force=true to bypass.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  get_strava_tokens,
  refresh_strava_access_token,
  get_strava_athlete_cache,
  save_strava_athlete_cache,
  get_strava_activities_cache,
  save_strava_activities_cache,
} from '@/lib/db';
import type { StravaTokens } from '@/lib/db';

async function require_auth(request: NextRequest): Promise<NextResponse | null> {
  const token = await getToken({ req: request });
  if (token) return null;

  const pin_header = request.headers.get('X-Guest-Pin');
  if (pin_header) {
    const valid_pins = (process.env.GUEST_PINS || process.env.GUEST_PIN || '')
      .split(',').map(p => p.trim()).filter(Boolean);
    if (valid_pins.includes(pin_header)) return null;
  }

  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}

function is_cache_fresh(fetched_at: string, ttl_hours = 1): boolean {
  return Date.now() - new Date(fetched_at).getTime() < ttl_hours * 3_600_000;
}

async function fetch_strava_data(tokens: StravaTokens): Promise<{
  athlete: Record<string, unknown>;
  stats: Record<string, unknown>;
  activities: Record<string, unknown>[];
  rate_limited: boolean;
}> {
  const headers = { 'Authorization': `Bearer ${tokens.access_token}` };

  const [athlete_res, stats_res, activities_res] = await Promise.all([
    fetch('https://www.strava.com/api/v3/athlete', { headers }),
    fetch(`https://www.strava.com/api/v3/athletes/${tokens.athlete_id}/stats`, { headers }),
    fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', { headers }),
  ]);

  // Log rate limit usage for monitoring
  const rate_usage = athlete_res.headers.get('X-RateLimit-Usage');
  if (rate_usage) console.log('Strava rate limit usage:', rate_usage);

  // Check for rate limiting
  if (athlete_res.status === 429 || stats_res.status === 429 || activities_res.status === 429) {
    return { athlete: {}, stats: {}, activities: [], rate_limited: true };
  }

  // Check for auth failures (401 signals expired/revoked token)
  if (athlete_res.status === 401 || stats_res.status === 401 || activities_res.status === 401) {
    throw new Error('STRAVA_UNAUTHORIZED');
  }

  const athlete = athlete_res.ok ? await athlete_res.json() : {};
  const stats = stats_res.ok ? await stats_res.json() : {};
  const activities_raw = activities_res.ok ? await activities_res.json() : [];

  return {
    athlete,
    stats,
    activities: Array.isArray(activities_raw) ? activities_raw : [],
    rate_limited: false,
  };
}

export async function GET(request: NextRequest) {
  const auth_error = await require_auth(request);
  if (auth_error) return auth_error;

  try {
    let tokens = await get_strava_tokens();
    if (!tokens) {
      return NextResponse.json({ error: 'Strava not connected', connected: false }, { status: 404 });
    }

    // Auto-refresh if expired (with 60s buffer). Strava tokens expire after 6 hours.
    if (tokens.expires_at < Math.floor(Date.now() / 1000) + 60) {
      try {
        tokens = await refresh_strava_access_token();
      } catch (err) {
        console.error('Strava token refresh failed:', err);
        return NextResponse.json(
          { error: 'Strava token expired. Please reconnect.', connected: false },
          { status: 401 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    // Serve from cache if fresh
    if (!force) {
      const [athlete_cache, activities_cache] = await Promise.all([
        get_strava_athlete_cache(),
        get_strava_activities_cache(),
      ]);

      if (
        athlete_cache && is_cache_fresh(athlete_cache.fetched_at) &&
        activities_cache && is_cache_fresh(activities_cache.fetched_at)
      ) {
        return NextResponse.json({
          success: true,
          connected: true,
          cached: true,
          cached_at: athlete_cache.fetched_at,
          athlete: athlete_cache.athlete,
          stats: athlete_cache.stats,
          activities: activities_cache.activities,
        });
      }
    }

    // Fetch fresh data
    let result = await fetch_strava_data(tokens);

    if (result.rate_limited) {
      return NextResponse.json(
        { error: 'Strava rate limit reached, try again in a few minutes' },
        { status: 429 }
      );
    }

    // 401 retry: refresh token and try once more
    if (Object.keys(result.athlete).length === 0) {
      try {
        tokens = await refresh_strava_access_token();
        result = await fetch_strava_data(tokens);
      } catch {
        return NextResponse.json(
          { error: 'Strava token invalid. Please reconnect.', connected: false },
          { status: 401 }
        );
      }
    }

    const fetched_at = new Date().toISOString();

    await Promise.allSettled([
      save_strava_athlete_cache({ athlete: result.athlete, stats: result.stats, fetched_at }),
      save_strava_activities_cache({ activities: result.activities, fetched_at }),
    ]);

    return NextResponse.json({
      success: true,
      connected: true,
      cached: false,
      cached_at: fetched_at,
      athlete: result.athlete,
      stats: result.stats,
      activities: result.activities,
    });

  } catch (error) {
    console.error('Strava data fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Strava data' },
      { status: 500 }
    );
  }
}
