/**
 * Proxy to protect routes (Next.js 16+)
 * Redirects unauthenticated users to login page
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request });

  if (!token) {
    const login_url = new URL('/login', request.url);
    login_url.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(login_url);
  }

  // /coach and /api/coaching/* are admin-only (non-guest).
  const path = request.nextUrl.pathname;
  const is_coach = path === '/coach' || path.startsWith('/coach/') || path.startsWith('/api/coaching');
  if (is_coach && token.sub === 'guest') {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Protect all routes except login, story, archive, games, weather, privacy, terms, api/auth, api/health, api/stories, api/prompts, api/oura, api/strava, and static files.
  matcher: [
    '/((?!login|story|archive|creative/archive|games|weather|privacy|terms|api/auth|api/health|api/stories|api/prompts|api/oura|api/strava|_next/static|_next/image|favicon.ico|icon.svg).*)',
  ],
};
