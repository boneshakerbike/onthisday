/**
 * API route: GET /api/coaching/history
 * Returns coaching sessions with pagination. Default page size 10.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { get_recent_sessions } from '@/lib/coaching/db';
import { get_client, ensure_schema } from '@/lib/db';

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request });
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const limit = Math.min(
      Number(request.nextUrl.searchParams.get('limit') ?? 10),
      50
    );
    const offset = Math.max(
      Number(request.nextUrl.searchParams.get('offset') ?? 0),
      0
    );

    await ensure_schema();
    const db = get_client();

    const [sessions, count_result] = await Promise.all([
      get_recent_sessions(limit, offset),
      db.execute({ sql: `SELECT COUNT(*) as total FROM coaching_history`, args: [] }),
    ]);

    const total = Number(count_result.rows[0]?.total ?? 0);

    return NextResponse.json({ sessions, total, limit, offset });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
