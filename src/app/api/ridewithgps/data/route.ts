/**
 * API route: GET /api/ridewithgps/data
 * Returns recent Ride with GPS trips, mapped to the shared activity shape.
 * Session-gated by proxy.ts's default (no proxy exemption — Basic Auth has
 * no OAuth callback to expose, unlike the old Strava integration).
 * Static Basic Auth credentials — no token refresh, no DB cache. Relies on
 * Next's fetch-level cache (5 min) for brief resilience against a blip.
 */

import { NextResponse } from 'next/server';
import { trip_to_activity, type RwgpsTripSummary } from '@/lib/ridewithgps';

export async function GET() {
  const api_key = process.env.RIDEWITHGPS_API_KEY;
  const auth_token = process.env.RIDEWITHGPS_AUTH_TOKEN;

  if (!api_key || !auth_token) {
    return NextResponse.json(
      { error: 'RIDEWITHGPS_API_KEY/RIDEWITHGPS_AUTH_TOKEN not configured' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch('https://ridewithgps.com/api/v1/trips.json?page=1&page_size=30', {
      headers: {
        'x-rwgps-api-key': api_key,
        'x-rwgps-auth-token': auth_token,
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('Ride with GPS trips fetch failed:', res.status, body);
      return NextResponse.json(
        { error: 'Failed to fetch Ride with GPS activities' },
        { status: 502 }
      );
    }

    const data = await res.json();
    const trips: RwgpsTripSummary[] = Array.isArray(data.trips) ? data.trips : [];

    return NextResponse.json({
      success: true,
      activities: trips.map(trip_to_activity),
      fetched_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Ride with GPS data fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Ride with GPS activities' },
      { status: 500 }
    );
  }
}
