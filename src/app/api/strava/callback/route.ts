/**
 * API route: GET /api/strava/callback
 * Handles OAuth redirect from Strava, exchanges code for tokens, primes all caches
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  save_strava_tokens,
  save_strava_athlete_cache,
  save_strava_activities_cache,
} from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const base_url = request.nextUrl.origin;

  // User denied access or Strava returned an error
  if (error) {
    console.error('Strava OAuth error:', error);
    return NextResponse.redirect(`${base_url}/health/strava?error=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${base_url}/health/strava?error=missing_params`);
  }

  // Validate CSRF state
  const stored_state = request.cookies.get('strava_state')?.value;
  if (!stored_state || stored_state !== state) {
    return NextResponse.redirect(`${base_url}/health/strava?error=invalid_state`);
  }

  try {
    // Must match the redirect_uri sent to /authorize exactly — always the production domain,
    // since Strava's Authorization Callback Domain doesn't vary per preview deployment.
    const app_base_url = process.env.NEXT_PUBLIC_APP_URL || 'https://8i11.vercel.app';

    // Exchange code for tokens
    const token_res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${app_base_url}/api/strava/callback`,
        client_id: process.env.STRAVA_CLIENT_ID || '',
        client_secret: process.env.STRAVA_CLIENT_SECRET || '',
      }),
    });

    if (!token_res.ok) {
      const err = await token_res.text();
      console.error('Strava token exchange failed:', token_res.status, err);
      return NextResponse.redirect(`${base_url}/health/strava?error=token_exchange_failed`);
    }

    const data = await token_res.json();

    // Strava returns expires_at directly as a Unix timestamp (not expires_in)
    await save_strava_tokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete_id: data.athlete.id,
    });

    const fetched_at = new Date().toISOString();
    const auth_header = { 'Authorization': `Bearer ${data.access_token}` };

    // Eagerly prime all three caches in parallel so the page loads with full data
    const [stats_res, activities_res] = await Promise.allSettled([
      fetch(`https://www.strava.com/api/v3/athletes/${data.athlete.id}/stats`, { headers: auth_header }),
      fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', { headers: auth_header }),
    ]);

    const stats = stats_res.status === 'fulfilled' && stats_res.value.ok
      ? await stats_res.value.json()
      : {};

    const activities = activities_res.status === 'fulfilled' && activities_res.value.ok
      ? await activities_res.value.json()
      : [];

    await Promise.allSettled([
      save_strava_athlete_cache({ athlete: data.athlete, stats, fetched_at }),
      save_strava_activities_cache({ activities: Array.isArray(activities) ? activities : [], fetched_at }),
    ]);

    const response = NextResponse.redirect(`${base_url}/health/strava?connected=true`);
    response.cookies.delete('strava_state');
    return response;

  } catch (err) {
    console.error('Strava callback error:', err);
    return NextResponse.redirect(`${base_url}/health/strava?error=callback_failed`);
  }
}
