/**
 * API route: GET /api/oura/data
 * Fetches daily wellness data from Oura (sleep, readiness, activity)
 * Auto-refreshes tokens when expired
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { get_oura_tokens, refresh_oura_access_token } from '@/lib/db';
import type { OuraTokens } from '@/lib/db';

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

async function oura_fetch(url: string, tokens: OuraTokens) {
  return fetch(url, {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` },
  });
}

export async function GET(request: NextRequest) {
  const auth_error = await require_auth(request);
  if (auth_error) return auth_error;

  try {
    let tokens = await get_oura_tokens();
    if (!tokens) {
      return NextResponse.json({ error: 'Oura not connected', connected: false }, { status: 404 });
    }

    // Auto-refresh if expired (with 60s buffer)
    if (tokens.expires_at < Math.floor(Date.now() / 1000) + 60) {
      try {
        tokens = await refresh_oura_access_token();
      } catch (err) {
        console.error('Oura token refresh failed:', err);
        return NextResponse.json(
          { error: 'Oura token expired. Please reconnect.', connected: false },
          { status: 401 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const target_date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const base = 'https://api.ouraring.com/v2/usercollection';
    const params = `start_date=${target_date}&end_date=${target_date}`;

    // Activity endpoint uses exclusive end_date, so bump by one day
    const next_day = new Date(target_date + 'T12:00:00Z');
    next_day.setDate(next_day.getDate() + 1);
    const activity_end = next_day.toISOString().split('T')[0];
    const activity_params = `start_date=${target_date}&end_date=${activity_end}`;

    // Fetch all three in parallel
    const [sleep_res, readiness_res, activity_res] = await Promise.all([
      oura_fetch(`${base}/daily_sleep?${params}`, tokens),
      oura_fetch(`${base}/daily_readiness?${params}`, tokens),
      oura_fetch(`${base}/daily_activity?${activity_params}`, tokens),
    ]);

    // If any return 401, try refresh once
    if (sleep_res.status === 401 || readiness_res.status === 401 || activity_res.status === 401) {
      try {
        tokens = await refresh_oura_access_token();
        // Retry all three
        const [s, r, a] = await Promise.all([
          oura_fetch(`${base}/daily_sleep?${params}`, tokens),
          oura_fetch(`${base}/daily_readiness?${params}`, tokens),
          oura_fetch(`${base}/daily_activity?${activity_params}`, tokens),
        ]);
        const sleep_data = await s.json();
        const readiness_data = await r.json();
        const activity_data = await a.json();

        return NextResponse.json({
          success: true,
          connected: true,
          date: target_date,
          sleep: sleep_data.data?.[0] || null,
          readiness: readiness_data.data?.[0] || null,
          activity: activity_data.data?.[0] || null,
        });
      } catch {
        return NextResponse.json(
          { error: 'Oura token invalid. Please reconnect.', connected: false },
          { status: 401 }
        );
      }
    }

    const sleep_data = await sleep_res.json();
    const readiness_data = await readiness_res.json();
    const activity_data = await activity_res.json();

    return NextResponse.json({
      success: true,
      connected: true,
      date: target_date,
      sleep: sleep_data.data?.[0] || null,
      readiness: readiness_data.data?.[0] || null,
      activity: activity_data.data?.[0] || null,
    });

  } catch (error) {
    console.error('Oura data fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Oura data' },
      { status: 500 }
    );
  }
}
