/**
 * API route: DELETE /api/strava/disconnect
 * Deauthorizes the Strava token and removes all stored tokens/cache
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { get_strava_tokens, delete_strava_tokens } from '@/lib/db';

export async function DELETE(request: NextRequest) {
  const token = await getToken({ req: request });
  const pin_header = request.headers.get('X-Guest-Pin');
  const valid_pins = (process.env.GUEST_PINS || process.env.GUEST_PIN || '')
    .split(',').map(p => p.trim()).filter(Boolean);

  if (!token && (!pin_header || !valid_pins.includes(pin_header))) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const tokens = await get_strava_tokens();

    // Deauthorize on Strava's side so the token is fully revoked
    if (tokens) {
      try {
        await fetch(
          `https://www.strava.com/oauth/deauthorize?access_token=${tokens.access_token}`,
          { method: 'POST' }
        );
      } catch (err) {
        // Log but don't block local cleanup
        console.warn('Strava deauthorize call failed:', err);
      }
    }

    await delete_strava_tokens();
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Strava disconnect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
