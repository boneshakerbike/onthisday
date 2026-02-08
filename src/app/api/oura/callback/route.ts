/**
 * API route: GET /api/oura/callback
 * Handles OAuth redirect from Oura, exchanges code for tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { save_oura_tokens } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const base_url = request.nextUrl.origin;

  // Oura returned an error
  if (error) {
    console.error('Oura OAuth error:', error);
    return NextResponse.redirect(`${base_url}/tools/wellness?error=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${base_url}/tools/wellness?error=missing_params`);
  }

  // Validate CSRF state
  const stored_state = request.cookies.get('oura_state')?.value;
  if (!stored_state || stored_state !== state) {
    return NextResponse.redirect(`${base_url}/tools/wellness?error=invalid_state`);
  }

  // Exchange code for tokens
  try {
    const token_res = await fetch('https://api.ouraring.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${base_url}/api/oura/callback`,
        client_id: process.env.OURA_CLIENT_ID || '',
        client_secret: process.env.OURA_CLIENT_SECRET || '',
      }),
    });

    if (!token_res.ok) {
      const error_text = await token_res.text();
      console.error('Oura token exchange failed:', token_res.status, error_text);
      return NextResponse.redirect(`${base_url}/tools/wellness?error=token_exchange_failed`);
    }

    const data = await token_res.json();

    await save_oura_tokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 86400),
      scope: 'daily',
    });

    const response = NextResponse.redirect(`${base_url}/tools/wellness?connected=true`);
    response.cookies.delete('oura_state');
    return response;

  } catch (err) {
    console.error('Oura callback error:', err);
    return NextResponse.redirect(`${base_url}/tools/wellness?error=callback_failed`);
  }
}
