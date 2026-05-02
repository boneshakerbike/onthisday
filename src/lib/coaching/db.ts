/**
 * Coaching database helpers
 * Reads from daily_metrics, writes trend_cache and coaching_history
 */

import { get_client, ensure_schema, get_wellness_cache, get_coros_data } from '@/lib/db';

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
  await ensure_schema();
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
  await ensure_schema();
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
  await ensure_schema();
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
  await ensure_schema();
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
  await ensure_schema();
  const db = get_client();
  const now = Math.floor(Date.now() / 1000);

  await db.execute({
    sql: `INSERT OR REPLACE INTO coaching_history
          (date, advice_full, advice_summary, conversation_turns, token_count, framework_version, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [session.date, session.advice_full, session.advice_summary, session.conversation_turns, session.token_count, '1.0', now],
  });
}

/**
 * Populate daily_metrics from wellness_cache (Oura) + coros_data (COROS) + optional manual inputs.
 * date_str: YYYY-MM-DD, epoch_day: Math.floor(Date.now() / 86400000)
 */
export interface InjectMetrics {
  readiness?: number | null;
  hrv?: number | null;
  resting_hr?: number | null;
  spo2?: number | null;
  sleep_total?: number | null;
  deep_sleep_min?: number | null;
  rem_sleep_min?: number | null;
  sleep_efficiency?: number | null;
  stress_min?: number | null;
  restored_min?: number | null;
}

export async function populate_daily_metrics(
  date_str: string,
  epoch_day: number,
  manual?: { weight_lbs?: number; back_pain_scale?: number; back_mobility_notes?: string; bowel_status?: string; injury_notes?: string },
  inject_metrics?: InjectMetrics,
): Promise<boolean> {
  await ensure_schema();
  const db = get_client();
  const now = Math.floor(Date.now() / 1000);

  const [oura, coros] = await Promise.all([
    get_wellness_cache(date_str),
    get_coros_data(date_str),
  ]);

  // Extract Oura fields — prefer cache, fall back to inject_metrics from live session
  let sleep_duration_min: number | null = null;
  let sleep_efficiency_pct: number | null = null;
  let deep_sleep_min: number | null = null;
  let rem_sleep_min: number | null = null;
  let hrv_rmssd: number | null = null;
  let resting_hr: number | null = null;
  let readiness_score: number | null = null;
  let cardiovascular_age: number | null = null;

  if (oura) {
    hrv_rmssd = oura.hrv_average;
    resting_hr = oura.resting_hr;
    readiness_score = oura.readiness_score;

    const sleep = oura.daily_sleep as { total_sleep_duration?: number; efficiency?: number; deep_sleep_duration?: number; rem_sleep_duration?: number } | null;
    if (sleep) {
      sleep_duration_min = sleep.total_sleep_duration ? Math.round(sleep.total_sleep_duration / 60) : null;
      sleep_efficiency_pct = sleep.efficiency ?? null;
      deep_sleep_min = sleep.deep_sleep_duration ? Math.round(sleep.deep_sleep_duration / 60) : null;
      rem_sleep_min = sleep.rem_sleep_duration ? Math.round(sleep.rem_sleep_duration / 60) : null;
    }

    const readiness = oura.daily_readiness as { score?: number } | null;
    if (readiness?.score) readiness_score = readiness.score;

    const cv = oura.daily_cardiovascular_age as { vascular_age?: number } | null;
    if (cv?.vascular_age) cardiovascular_age = cv.vascular_age;
  } else if (inject_metrics) {
    // No cache for today — use metrics computed during inject from live Oura data
    hrv_rmssd = inject_metrics.hrv ?? null;
    resting_hr = inject_metrics.resting_hr ?? null;
    readiness_score = inject_metrics.readiness ?? null;
    sleep_duration_min = inject_metrics.sleep_total ?? null;
    sleep_efficiency_pct = inject_metrics.sleep_efficiency ?? null;
    deep_sleep_min = inject_metrics.deep_sleep_min ?? null;
    rem_sleep_min = inject_metrics.rem_sleep_min ?? null;
  }

  // Extract COROS fields
  let vo2_max: number | null = null;
  let training_load_acute: number | null = null;
  let training_load_chronic: number | null = null;
  let recovery_pct: number | null = null;

  if (coros) {
    const d = coros.data as Record<string, unknown>;
    const dash = d.dashboard as Record<string, unknown> | undefined;

    if (dash) {
      const ts = dash.training_status as Record<string, unknown> | undefined;
      if (ts) {
        if (ts.load_impact !== undefined) training_load_acute = Number(ts.load_impact);
        if (ts.base_fitness !== undefined) training_load_chronic = Number(ts.base_fitness);
      }
      const rec = dash.recovery as Record<string, unknown> | undefined;
      if (rec?.percentage !== undefined) recovery_pct = Number(rec.percentage);
    } else {
      // Flat field fallback for older data
      if (d.vo2_max !== undefined) vo2_max = Number(d.vo2_max);
      if (d.recovery !== undefined) recovery_pct = Number(d.recovery);
      if (d.training_load !== undefined) training_load_acute = Number(d.training_load);
    }
  }

  await db.execute({
    sql: `INSERT OR REPLACE INTO daily_metrics (
      date, sleep_duration_min, sleep_efficiency_pct, deep_sleep_min, rem_sleep_min,
      hrv_rmssd, resting_hr, readiness_score, cardiovascular_age,
      vo2_max, training_load_acute, training_load_chronic, recovery_pct,
      zone2_min_weekly, vo2max_intervals_weekly,
      weight_lbs, back_pain_scale, back_mobility_notes, bowel_status, injury_notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      epoch_day,
      sleep_duration_min, sleep_efficiency_pct, deep_sleep_min, rem_sleep_min,
      hrv_rmssd, resting_hr, readiness_score, cardiovascular_age,
      vo2_max, training_load_acute, training_load_chronic, recovery_pct,
      null, null, // zone2_min_weekly, vo2max_intervals_weekly — computed separately
      manual?.weight_lbs ?? null, manual?.back_pain_scale ?? null,
      manual?.back_mobility_notes ?? null, manual?.bowel_status ?? null, manual?.injury_notes ?? null,
      now, now,
    ],
  });

  return true;
}

/**
 * Get the most recent non-null weight and back_pain from daily_metrics.
 * Used as fallback when manual inputs aren't provided for today's session.
 */
export async function get_last_known_manual_metrics(): Promise<{
  weight_lbs: number | null;
  weight_date: number | null;
  back_pain_scale: number | null;
  back_pain_date: number | null;
}> {
  await ensure_schema();
  const db = get_client();
  const [weight_row, back_row] = await Promise.all([
    db.execute({ sql: `SELECT date, weight_lbs FROM daily_metrics WHERE weight_lbs IS NOT NULL ORDER BY date DESC LIMIT 1`, args: [] }),
    db.execute({ sql: `SELECT date, back_pain_scale FROM daily_metrics WHERE back_pain_scale IS NOT NULL ORDER BY date DESC LIMIT 1`, args: [] }),
  ]);
  return {
    weight_lbs: weight_row.rows.length > 0 ? Number(weight_row.rows[0].weight_lbs) : null,
    weight_date: weight_row.rows.length > 0 ? Number(weight_row.rows[0].date) : null,
    back_pain_scale: back_row.rows.length > 0 ? Number(back_row.rows[0].back_pain_scale) : null,
    back_pain_date: back_row.rows.length > 0 ? Number(back_row.rows[0].date) : null,
  };
}

export interface CoachingSession {
  date: number;
  advice_full: string;
  advice_summary: string | null;
  conversation_turns: number;
  created_at: number;
}

/**
 * Get recent coaching sessions for context injection.
 * Returns most recent N sessions, newest first.
 */
export async function get_recent_sessions(limit: number = 3, offset: number = 0): Promise<CoachingSession[]> {
  await ensure_schema();
  const db = get_client();
  const result = await db.execute({
    sql: `SELECT date, advice_full, advice_summary, conversation_turns, created_at
          FROM coaching_history ORDER BY date DESC LIMIT ? OFFSET ?`,
    args: [limit, offset],
  });
  return result.rows.map(row => ({
    date: Number(row.date),
    advice_full: row.advice_full as string,
    advice_summary: (row.advice_summary as string) ?? null,
    conversation_turns: Number(row.conversation_turns),
    created_at: Number(row.created_at),
  }));
}
