/**
 * API route: GET /api/oura/authorize
 * Redirects user to Oura OAuth consent screen
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function GET(request: NextRequest) {
  // Require authentication
  const token = await getToken({ req: request });
  const pin_header = request.headers.get('X-Guest-Pin');
  const valid_pins = (process.env.GUEST_PINS || process.env.GUEST_PIN || '')
    .split(',').map(p => p.trim()).filter(Boolean);

  if (!token && (!pin_header || !valid_pins.includes(pin_header))) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const client_id = process.env.OURA_CLIENT_ID;
  if (!client_id) {
    return NextResponse.json({ error: 'OURA_CLIENT_ID not configured' }, { status: 500 });
  }

  // Generate CSRF state
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const redirect_uri = `${request.nextUrl.origin}/api/oura/callback`;

  const params = new URLSearchParams({
    client_id,
    redirect_uri,
    response_type: 'code',
    scope: 'personal daily heartrate spo2 workout session',
    state,
  });

  const response = NextResponse.redirect(`https://cloud.ouraring.com/oauth/authorize?${params}`);
  response.cookies.set('oura_state', state, {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    maxAge: 600,
    path: '/',
    sameSite: 'lax',
  });

  return response;
}
