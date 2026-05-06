/**
 * API route: GET /api/coaching/trends/today
 * Returns day-over-day metric deltas with health interpretation.
 * Used by the coach page for trending arrows on metric cards.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { get_client, ensure_schema } from '@/lib/db';
import { METRIC_CONFIG, computeTrend, type MetricTrend } from '@/lib/coaching/metric-config';

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request });
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    await ensure_schema();
    const db = get_client();
    const today = Math.floor(Date.now() / 86400000);
    const yesterday = today - 1;

    // Fetch today and yesterday rows in one query
    const result = await db.execute({
      sql: `SELECT * FROM daily_metrics WHERE date IN (?, ?) ORDER BY date ASC`,
      args: [yesterday, today],
    });

    const yesterdayRow = result.rows.find(r => Number(r.date) === yesterday);
    const todayRow = result.rows.find(r => Number(r.date) === today);

    const trends: MetricTrend[] = [];

    for (const [key, def] of Object.entries(METRIC_CONFIG)) {
      const todayVal = todayRow?.[def.dbColumn] != null ? Number(todayRow[def.dbColumn]) : null;
      const yesterdayVal = yesterdayRow?.[def.dbColumn] != null ? Number(yesterdayRow[def.dbColumn]) : null;

      const trend = computeTrend(key, todayVal, yesterdayVal);
      if (trend) {
        trends.push(trend);
      }
    }

    return NextResponse.json({ trends });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compute trends' },
      { status: 500 }
    );
  }
}
