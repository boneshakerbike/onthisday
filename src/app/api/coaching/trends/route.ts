/**
 * API route: GET /api/coaching/trends
 * Vercel cron endpoint — computes 7/30-day rolling averages.
 * Protected by CRON_SECRET header check.
 * Runs daily at 2am via vercel.json cron config.
 */

import { NextRequest, NextResponse } from 'next/server';
import { compute_trends, cleanup_trend_cache, cleanup_daily_metrics, populate_daily_metrics } from '@/lib/coaching/db';
import { mt_epoch_day, epoch_day_to_date_str } from '@/lib/coaching/day';

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this automatically for cron jobs)
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const today = mt_epoch_day();

    // Populate daily_metrics from cached Oura for yesterday
    // (cron runs at 9am UTC = 2-3am MT, so yesterday's data is complete)
    const yesterday_epoch = today - 1;
    const yesterday_str = epoch_day_to_date_str(yesterday_epoch);
    const populated = await populate_daily_metrics(yesterday_str, yesterday_epoch);

    const trend_result = await compute_trends(today);
    const trends_cleaned = await cleanup_trend_cache(today);
    const metrics_cleaned = await cleanup_daily_metrics(today);

    return NextResponse.json({
      ok: true,
      date: today,
      populated_yesterday: populated,
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
