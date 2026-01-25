/**
 * Middleware to protect routes
 * Redirects unauthenticated users to login page
 */

import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

export const config = {
  // Protect all routes except login, api/auth, and static files
  matcher: [
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
