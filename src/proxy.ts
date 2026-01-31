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

  return NextResponse.next();
}

export const config = {
  // Protect all routes except login, story, api/auth, api/health, api/suggestions, and static files
  matcher: [
    '/((?!login|story|api/auth|api/health|api/suggestions|_next/static|_next/image|favicon.ico).*)',
  ],
};
