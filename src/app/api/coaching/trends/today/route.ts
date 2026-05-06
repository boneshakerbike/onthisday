/**
 * API route: POST /api/coaching/trends/today
 * Accepts today's live metrics, ensures daily_metrics is populated,
 * then returns day-over-day deltas with health interpretation.
 * Used by the coach page for trending arrows on metric cards.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { get_client, ensure_schema } from '@/lib/db';
import { METRIC_CONFIG, computeTrend, type MetricTrend } from '@/lib/coaching/metric-config';

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request });
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    await ensure_schema();
    const db = get_client();
    const today = Math.floor(Date.now() / 86400000);
    const yesterday = today - 1;
    const now = Math.floor(Date.now() / 1000);

    const body = await request.json().catch(() => ({}));
    const liveMetrics = body.metrics as Record<string, number | null> | undefined;

    // If live metrics provided, ensure today's daily_metrics row exists
    if (liveMetrics) {
      const existing = await db.execute({
        sql: `SELECT date FROM daily_metrics WHERE date = ?`,
        args: [today],
      });

      if (existing.rows.length === 0) {
        // Estimate CV age from HRV + RHR if not provided directly
        let cv_age = liveMetrics.cardiovascular_age ?? null;
        if (cv_age == null && liveMetrics.hrv_rmssd != null && liveMetrics.resting_hr != null) {
          const hrv_age = 107 - (12.5 * Math.log(liveMetrics.hrv_rmssd));
          const rhr_age = 1.4 * liveMetrics.resting_hr - 40;
          cv_age = Math.round(0.65 * hrv_age + 0.35 * rhr_age);
        }

        await db.execute({
          sql: `INSERT OR IGNORE INTO daily_metrics (
            date, sleep_duration_min, sleep_efficiency_pct, deep_sleep_min, rem_sleep_min,
            hrv_rmssd, resting_hr, readiness_score, cardiovascular_age, spo2_average,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            today,
            liveMetrics.sleep_duration_min ?? null,
            liveMetrics.sleep_efficiency_pct ?? null,
            liveMetrics.deep_sleep_min ?? null,
            liveMetrics.rem_sleep_min ?? null,
            liveMetrics.hrv_rmssd ?? null,
            liveMetrics.resting_hr ?? null,
            liveMetrics.readiness_score ?? null,
            cv_age,
            liveMetrics.spo2_average ?? null,
            now, now,
          ],
        });
      }
    }

    // Fetch today and yesterday rows
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
