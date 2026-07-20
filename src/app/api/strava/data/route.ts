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
  athlete_ok: boolean;
  activities: Record<string, unknown>[];
  activities_ok: boolean;
  rate_limited: boolean;
}> {
  const headers = { 'Authorization': `Bearer ${tokens.access_token}` };

  const [athlete_res, stats_res, activities_res] = await Promise.allSettled([
    fetch('https://www.strava.com/api/v3/athlete', { headers }),
    fetch(`https://www.strava.com/api/v3/athletes/${tokens.athlete_id}/stats`, { headers }),
    fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', { headers }),
  ]);

  // Log rate limit usage for monitoring
  const rate_usage = athlete_res.status === 'fulfilled' ? athlete_res.value.headers.get('X-RateLimit-Usage') : null;
  if (rate_usage) console.log('Strava rate limit usage:', rate_usage);

  // Check for rate limiting
  const any_429 = [athlete_res, stats_res, activities_res].some(r => r.status === 'fulfilled' && r.value.status === 429);
  if (any_429) {
    return { athlete: {}, stats: {}, athlete_ok: false, activities: [], activities_ok: false, rate_limited: true };
  }

  // Check for auth failures (401 signals expired/revoked token)
  const any_401 = [athlete_res, stats_res, activities_res].some(r => r.status === 'fulfilled' && r.value.status === 401);
  if (any_401) {
    throw new Error('STRAVA_UNAUTHORIZED');
  }

  const athlete_ok = athlete_res.status === 'fulfilled' && athlete_res.value.ok
    && stats_res.status === 'fulfilled' && stats_res.value.ok;
  const athlete = athlete_ok ? await (athlete_res as PromiseFulfilledResult<Response>).value.json() : {};
  const stats = athlete_ok ? await (stats_res as PromiseFulfilledResult<Response>).value.json() : {};

  const activities_ok = activities_res.status === 'fulfilled' && activities_res.value.ok;
  const activities_raw = activities_ok ? await (activities_res as PromiseFulfilledResult<Response>).value.json() : [];

  return {
    athlete,
    stats,
    athlete_ok,
    activities: Array.isArray(activities_raw) ? activities_raw : [],
    activities_ok: activities_ok && Array.isArray(activities_raw),
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

    const [athlete_cache, activities_cache] = await Promise.all([
      get_strava_athlete_cache(),
      get_strava_activities_cache(),
    ]);

    // Serve from cache if fresh
    if (
      !force &&
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

    // Fetch fresh data
    let result = await fetch_strava_data(tokens);

    if (result.rate_limited) {
      // Rate limited — serve whatever we have cached rather than blanking the dashboard
      if (athlete_cache || activities_cache) {
        return NextResponse.json({
          success: true,
          connected: true,
          cached: true,
          partial_error: 'Strava rate limit reached — showing last saved data',
          cached_at: athlete_cache?.fetched_at ?? activities_cache?.fetched_at ?? null,
          athlete: athlete_cache?.athlete ?? {},
          stats: athlete_cache?.stats ?? {},
          activities: activities_cache?.activities ?? [],
        });
      }
      return NextResponse.json(
        { error: 'Strava rate limit reached, try again in a few minutes' },
        { status: 429 }
      );
    }

    // Profile fetch failed for a non-429 reason: refresh token and try once more
    if (!result.athlete_ok) {
      try {
        tokens = await refresh_strava_access_token();
        result = await fetch_strava_data(tokens);
      } catch {
        // Refresh token itself is invalid — only a hard failure if there's no cache to fall back on
        if (!athlete_cache) {
          return NextResponse.json(
            { error: 'Strava token invalid. Please reconnect.', connected: false },
            { status: 401 }
          );
        }
      }
    }

    const fetched_at = new Date().toISOString();

    // Only overwrite each cache with the sub-fetch that actually succeeded
    const saves: Promise<void>[] = [];
    if (result.athlete_ok) saves.push(save_strava_athlete_cache({ athlete: result.athlete, stats: result.stats, fetched_at }));
    if (result.activities_ok) saves.push(save_strava_activities_cache({ activities: result.activities, fetched_at }));
    await Promise.allSettled(saves);

    const athlete = result.athlete_ok ? result.athlete : (athlete_cache?.athlete ?? {});
    const stats = result.athlete_ok ? result.stats : (athlete_cache?.stats ?? {});
    const activities = result.activities_ok ? result.activities : (activities_cache?.activities ?? []);

    if (!result.athlete_ok && !athlete_cache) {
      return NextResponse.json(
        { error: 'Failed to fetch Strava profile. Please try again.', connected: true },
        { status: 502 }
      );
    }

    let partial_error: string | null = null;
    if (!result.athlete_ok && !result.activities_ok) {
      partial_error = 'Could not refresh Strava data — showing last saved data';
    } else if (!result.activities_ok) {
      partial_error = 'Could not refresh recent activities — showing last saved data';
    } else if (!result.athlete_ok) {
      partial_error = 'Could not refresh athlete profile — showing last saved data';
    }

    return NextResponse.json({
      success: true,
      connected: true,
      cached: false,
      cached_at: fetched_at,
      athlete,
      stats,
      activities,
      ...(partial_error ? { partial_error } : {}),
    });

  } catch (error) {
    console.error('Strava data fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Strava data' },
      { status: 500 }
    );
  }
}
