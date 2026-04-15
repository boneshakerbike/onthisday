/**
 * API route: GET /api/coaching/trends
 * Vercel cron endpoint — computes 7/30-day rolling averages.
 * Protected by CRON_SECRET header check.
 * Runs daily at 2am via vercel.json cron config.
 */

import { NextRequest, NextResponse } from 'next/server';
import { compute_trends, cleanup_trend_cache, cleanup_daily_metrics } from '@/lib/coaching/db';

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this automatically for cron jobs)
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Use epoch days as the date key (matches daily_metrics.date)
    const today = Math.floor(Date.now() / 86400000);

    const trend_result = await compute_trends(today);
    const trends_cleaned = await cleanup_trend_cache(today);
    const metrics_cleaned = await cleanup_daily_metrics(today);

    return NextResponse.json({
      ok: true,
      date: today,
      trends: trend_result,
      cleaned: { trend_cache: trends_cleaned, daily_metrics: metrics_cleaned },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Trend computation failed' },
      { status: 500 }
    );
  }
}
