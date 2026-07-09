/**
 * API route: GET /api/coaching/today
 * Returns the coaching session saved for today (or null) so the coach
 * page can show the completed view instead of the start form.
 * Accepts ?date=<epoch-day> from the client so the check uses the same
 * day value the client sends to finalize.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { get_session_by_date } from '@/lib/coaching/db';

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request });
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const param = Number(request.nextUrl.searchParams.get('date'));
    const date = Number.isFinite(param) && param > 0 ? param : Math.floor(Date.now() / 86400000);
    const session = await get_session_by_date(date);
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch today's session" },
      { status: 500 }
    );
  }
}
