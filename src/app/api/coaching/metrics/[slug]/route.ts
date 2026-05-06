/**
 * API route: GET /api/coaching/metrics/[slug]?range=7|30|90
 * Returns daily values for a specific metric over a time range.
 * Used by metric detail/trend pages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { get_client, ensure_schema } from '@/lib/db';
import { getMetricBySlug } from '@/lib/coaching/metric-config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const token = await getToken({ req: request });
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { slug } = await params;
  const def = getMetricBySlug(slug);
  if (!def) {
    return NextResponse.json({ error: 'Unknown metric' }, { status: 404 });
  }

  const range = parseInt(request.nextUrl.searchParams.get('range') || '7');
  const validRanges = [7, 30, 90];
  const days = validRanges.includes(range) ? range : 7;

  try {
    await ensure_schema();
    const db = get_client();
    const today = Math.floor(Date.now() / 86400000);
    const startDate = today - days;

    const result = await db.execute({
      sql: `SELECT date, ${def.dbColumn} as value FROM daily_metrics WHERE date > ? AND date <= ? ORDER BY date ASC`,
      args: [startDate, today],
    });

    const dataPoints = result.rows
      .filter(r => r.value != null)
      .map(r => ({
        date: Number(r.date),
        dateStr: new Date(Number(r.date) * 86400000).toISOString().split('T')[0],
        value: Number(r.value),
      }));

    // Compute simple average
    const values = dataPoints.map(d => d.value);
    const avg = values.length > 0
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
      : null;

    return NextResponse.json({
      slug: def.slug,
      label: def.label,
      unit: def.unit,
      higherIsBetter: def.higherIsBetter,
      range: days,
      average: avg,
      dataPoints,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch metric data' },
      { status: 500 }
    );
  }
}
