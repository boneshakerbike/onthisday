/**
 * API route: GET /api/coaching/history
 * Returns recent coaching sessions. Default 30, max 90.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { get_recent_sessions } from '@/lib/coaching/db';

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request });
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const limit = Math.min(
      Number(request.nextUrl.searchParams.get('limit') ?? 30),
      90
    );
    const sessions = await get_recent_sessions(limit);
    return NextResponse.json({ sessions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
