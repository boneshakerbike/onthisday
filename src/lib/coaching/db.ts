/**
 * Coaching database helpers
 * Reads from daily_metrics, writes trend_cache and coaching_history
 */

import { createClient, Client } from '@libsql/client';
import path from 'path';
import fs from 'fs';

const is_turso = !!process.env.TURSO_DATABASE_URL;

let client: Client | null = null;

function get_client(): Client {
  if (!client) {
    if (is_turso) {
      client = createClient({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
    } else {
      const db_path = path.join(process.cwd(), 'data', 'posts.db');
      const dir = path.dirname(db_path);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      client = createClient({ url: `file:${db_path}` });
    }
  }
  return client;
}

// Numeric columns in daily_metrics that get trend computation
const TREND_METRICS = [
  'sleep_duration_min',
  'sleep_efficiency_pct',
  'deep_sleep_min',
  'rem_sleep_min',
  'hrv_rmssd',
  'resting_hr',
  'readiness_score',
  'cardiovascular_age',
  'vo2_max',
  'training_load_acute',
  'training_load_chronic',
  'recovery_pct',
  'zone2_min_weekly',
  'vo2max_intervals_weekly',
  'weight_lbs',
  'back_pain_scale',
] as const;

function compute_direction(values: number[]): string {
  if (values.length < 3) return 'stable';
  const first_half = values.slice(0, Math.floor(values.length / 2));
  const second_half = values.slice(Math.floor(values.length / 2));
  const first_avg = first_half.reduce((a, b) => a + b, 0) / first_half.length;
  const second_avg = second_half.reduce((a, b) => a + b, 0) / second_half.length;
  if (first_avg === 0) return 'stable';
  const change_pct = ((second_avg - first_avg) / Math.abs(first_avg)) * 100;
  if (change_pct > 3) return 'improving';
  if (change_pct < -3) return 'declining';
  return 'stable';
}

function compute_change_pct(values: number[]): number {
  if (values.length < 2) return 0;
  const oldest = values[0];
  const newest = values[values.length - 1];
  if (oldest === 0) return 0;
  return Math.round(((newest - oldest) / Math.abs(oldest)) * 1000) / 1000;
}

/**
 * Compute 7-day and 30-day rolling averages for all numeric metrics
 * and write to trend_cache. Called by the cron endpoint.
 */
export async function compute_trends(target_date: number): Promise<{ metrics_computed: number; rows_written: number }> {
  const db = get_client();
  const now = Math.floor(Date.now() / 1000);

  // Fetch last 30 days of daily_metrics
  const thirty_days_ago = target_date - 30;
  const result = await db.execute({
    sql: `SELECT * FROM daily_metrics WHERE date > ? AND date <= ? ORDER BY date ASC`,
    args: [thirty_days_ago, target_date],
  });

  if (result.rows.length === 0) {
    return { metrics_computed: 0, rows_written: 0 };
  }

  let rows_written = 0;

  for (const metric of TREND_METRICS) {
    // Extract non-null values with their dates
    const all_values: number[] = [];
    const seven_day_values: number[] = [];
    const seven_days_ago = target_date - 7;

    for (const row of result.rows) {
      const val = row[metric];
      if (val !== null && val !== undefined) {
        const num_val = Number(val);
        all_values.push(num_val);
        if (Number(row.date) > seven_days_ago) {
          seven_day_values.push(num_val);
        }
      }
    }

    if (all_values.length === 0) continue;

    const avg_7 = seven_day_values.length > 0
      ? Math.round((seven_day_values.reduce((a, b) => a + b, 0) / seven_day_values.length) * 100) / 100
      : null;
    const avg_30 = Math.round((all_values.reduce((a, b) => a + b, 0) / all_values.length) * 100) / 100;

    const dir_7 = seven_day_values.length >= 3 ? compute_direction(seven_day_values) : 'stable';
    const dir_30 = all_values.length >= 3 ? compute_direction(all_values) : 'stable';

    const change_7 = seven_day_values.length >= 2 ? compute_change_pct(seven_day_values) : 0;
    const change_30 = all_values.length >= 2 ? compute_change_pct(all_values) : 0;

    await db.execute({
      sql: `INSERT OR REPLACE INTO trend_cache
            (date, metric_name, value_7day_avg, value_30day_avg,
             value_7day_direction, value_30day_direction,
             value_7day_change_pct, value_30day_change_pct, computed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [target_date, metric, avg_7, avg_30, dir_7, dir_30, change_7, change_30, now],
    });
    rows_written++;
  }

  return { metrics_computed: TREND_METRICS.length, rows_written };
}

export interface TrendRow {
  date: number;
  metric_name: string;
  value_7day_avg: number | null;
  value_30day_avg: number | null;
  value_7day_direction: string | null;
  value_30day_direction: string | null;
  value_7day_change_pct: number | null;
  value_30day_change_pct: number | null;
}

/**
 * Get all trend rows for a given date
 */
export async function get_trends(target_date: number): Promise<TrendRow[]> {
  const db = get_client();
  const result = await db.execute({
    sql: `SELECT * FROM trend_cache WHERE date = ?`,
    args: [target_date],
  });
  return result.rows.map(row => ({
    date: Number(row.date),
    metric_name: row.metric_name as string,
    value_7day_avg: row.value_7day_avg !== null ? Number(row.value_7day_avg) : null,
    value_30day_avg: row.value_30day_avg !== null ? Number(row.value_30day_avg) : null,
    value_7day_direction: row.value_7day_direction as string | null,
    value_30day_direction: row.value_30day_direction as string | null,
    value_7day_change_pct: row.value_7day_change_pct !== null ? Number(row.value_7day_change_pct) : null,
    value_30day_change_pct: row.value_30day_change_pct !== null ? Number(row.value_30day_change_pct) : null,
  }));
}

/**
 * Clean up trend_cache entries older than 90 days
 */
export async function cleanup_trend_cache(today: number): Promise<number> {
  const db = get_client();
  const cutoff = today - 90;
  const result = await db.execute({
    sql: `DELETE FROM trend_cache WHERE date < ?`,
    args: [cutoff],
  });
  return result.rowsAffected;
}

/**
 * Clean up daily_metrics entries older than 365 days
 */
export async function cleanup_daily_metrics(today: number): Promise<number> {
  const db = get_client();
  const cutoff = today - 365;
  const result = await db.execute({
    sql: `DELETE FROM daily_metrics WHERE date < ?`,
    args: [cutoff],
  });
  return result.rowsAffected;
}

/**
 * Save a coaching session to coaching_history
 */
export async function save_coaching_session(session: {
  date: number;
  advice_full: string;
  advice_summary: string | null;
  conversation_turns: number;
  token_count: number;
}): Promise<void> {
  const db = get_client();
  const now = Math.floor(Date.now() / 1000);

  await db.execute({
    sql: `INSERT OR REPLACE INTO coaching_history
          (date, advice_full, advice_summary, conversation_turns, token_count, framework_version, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [session.date, session.advice_full, session.advice_summary, session.conversation_turns, session.token_count, '1.0', now],
  });
}
