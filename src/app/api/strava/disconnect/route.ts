/**
 * API route: DELETE /api/strava/disconnect
 * Revokes the Strava token (oauth/revoke) and removes all stored tokens/cache
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

    // Revoke on Strava's side so the token is fully invalidated.
    // Uses oauth/revoke (oauth/deauthorize is retired June 1, 2027).
    if (tokens) {
      try {
        const revoke_res = await fetch('https://www.strava.com/oauth/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ access_token: tokens.access_token }),
        });
        if (!revoke_res.ok) {
          console.warn('Strava revoke returned non-OK:', revoke_res.status, await revoke_res.text());
        }
      } catch (err) {
        // Log but don't block local cleanup
        console.warn('Strava revoke call failed:', err);
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
