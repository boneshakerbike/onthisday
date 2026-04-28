/**
 * Data injection formatter for coaching sessions.
 * Pulls Oura data from wellness_cache + Strava activities + manual inputs.
 * No COROS. Oura drives decisions. Strava is context only.
 */

import { get_wellness_cache } from '@/lib/db';
import { get_trends, get_last_known_manual_metrics, type TrendRow } from '@/lib/coaching/db';

export interface ManualInputs {
  weight_lbs?: number;
  back_pain_scale?: number;
  back_mobility_notes?: string;
  bowel_status?: string;
  injury_notes?: string;
}

interface OuraSleepDetail {
  total_sleep_duration?: number;
  efficiency?: number;
  deep_sleep_duration?: number;
  rem_sleep_duration?: number;
}

interface OuraReadinessDetail {
  score?: number;
}

interface OuraCardiovascularAge {
  vascular_age?: number;
}

interface OuraStressDetail {
  stress_high?: number;
  recovery_high?: number;
  day_summary?: string;
}

interface StravaActivity {
  name?: string;
  type?: string;
  sport_type?: string;
  start_date_local?: string;
  distance?: number;
  moving_time?: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  has_heartrate?: boolean;
}

function seconds_to_hm(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function fmt_trend(value: number | null, trends: Map<string, TrendRow>, metric: string, unit: string): string {
  if (value === null || value === undefined) return 'no data';
  const t = trends.get(metric);
  let s = `${value}${unit}`;
  if (t) {
    if (t.value_7day_avg !== null) s += ` (7d avg: ${t.value_7day_avg}${unit}`;
    if (t.value_30day_avg !== null) s += `, 30d avg: ${t.value_30day_avg}${unit}`;
    if (t.value_7day_direction && t.value_7day_direction !== 'stable') s += ` [${t.value_7day_direction}]`;
    s += ')';
  }
  return s;
}

/**
 * Build the data injection string for a coaching session.
 * date_str: YYYY-MM-DD format
 * epoch_day: Math.floor(Date.now() / 86400000) for trend_cache lookup
 */
export async function build_data_injection(
  date_str: string,
  epoch_day: number,
  manual: ManualInputs,
  oura_live?: Record<string, unknown> | null,
  strava_activities?: StravaActivity[] | null,
): Promise<{ injection: string; metrics: Record<string, unknown> }> {
  const yesterday = new Date(date_str + 'T12:00:00');
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterday_str = yesterday.toISOString().split('T')[0];

  const [oura_initial, trend_rows, last_manual] = await Promise.all([
    get_wellness_cache(date_str),
    get_trends(epoch_day),
    get_last_known_manual_metrics(),
  ]);
  let oura = oura_initial;

  // If live Oura data was passed from the client, use it over cache
  if (oura_live && oura_live.success) {
    const scores = oura_live.scores as Record<string, unknown> | undefined;
    const daily_sleep = oura_live.daily_sleep as OuraSleepDetail | undefined;
    const readiness = oura_live.readiness as OuraReadinessDetail | undefined;
    oura = {
      date: date_str,
      sleep_score: (scores?.sleep as number) ?? null,
      readiness_score: (scores?.readiness as number) ?? null,
      activity_score: (scores?.activity as number) ?? null,
      stress_high: (scores?.stress_high as number) ?? null,
      recovery_high: (scores?.recovery_high as number) ?? null,
      hrv_average: (scores?.hrv_average as number) ?? null,
      resting_hr: (scores?.resting_hr as number) ?? null,
      spo2_average: (scores?.spo2_average as number) ?? null,
      steps: null,
      active_calories: null,
      daily_sleep: daily_sleep ?? null,
      daily_readiness: readiness ?? null,
      daily_activity: null,
      daily_stress: oura_live.daily_stress ?? null,
      daily_resilience: null,
      daily_cardiovascular_age: null,
      daily_spo2: null,
      sleep_detail: null,
      heartrate: null,
      vo2_max: null,
      workouts: null,
      sessions: null,
      sleep_time: null,
      fetched_at: new Date().toISOString(),
    };
  }

  // Fall back to yesterday's cached data if today's isn't available
  if (!oura) {
    oura = await get_wellness_cache(yesterday_str);
  }

  const trends = new Map<string, TrendRow>();
  for (const row of trend_rows) {
    trends.set(row.metric_name, row);
  }

  // Build metrics object for pre-chat display
  const metrics: Record<string, unknown> = {};
  const lines: string[] = [];
  lines.push(`Health data for ${date_str}:`);
  lines.push('');

  // --- OURA ---
  const oura_label = oura?.date === yesterday_str ? `using ${yesterday_str} data` : '';
  if (oura) {
    const sleep = oura.daily_sleep as OuraSleepDetail | null;
    const readiness = oura.daily_readiness as OuraReadinessDetail | null;
    const cv_age = oura.daily_cardiovascular_age as OuraCardiovascularAge | null;
    const stress = oura.daily_stress as OuraStressDetail | null;

    const readiness_val = readiness?.score ?? oura.readiness_score ?? null;
    const hrv_val = oura.hrv_average ?? null;
    const rhr_val = oura.resting_hr ?? null;
    const spo2_val = oura.spo2_average ?? null;

    metrics.readiness = readiness_val;
    metrics.hrv = hrv_val;
    metrics.resting_hr = rhr_val;
    metrics.spo2 = spo2_val;
    metrics.sleep_score = oura.sleep_score;

    if (oura_label) lines.push(`(Oura ${oura_label})`);
    lines.push(`Readiness: ${readiness_val ?? 'N/A'}/100`);
    lines.push(`HRV: ${fmt_trend(hrv_val, trends, 'hrv_rmssd', 'ms')}`);
    lines.push(`Resting HR: ${fmt_trend(rhr_val, trends, 'resting_hr', ' bpm')}`);

    if (sleep) {
      const total = sleep.total_sleep_duration ? seconds_to_hm(sleep.total_sleep_duration) : 'N/A';
      const deep = sleep.deep_sleep_duration ? seconds_to_hm(sleep.deep_sleep_duration) : 'N/A';
      const deep_min = sleep.deep_sleep_duration ? Math.round(sleep.deep_sleep_duration / 60) : null;
      const efficiency = sleep.efficiency ? `${sleep.efficiency}%` : 'N/A';
      lines.push(`Sleep: ${total} total, ${deep} deep, efficiency ${efficiency}`);
      metrics.sleep_total = sleep.total_sleep_duration ? Math.round(sleep.total_sleep_duration / 60) : null;
      metrics.deep_sleep_min = deep_min;
      metrics.sleep_efficiency = sleep.efficiency ?? null;
    } else if (oura.sleep_score) {
      lines.push(`Sleep score: ${oura.sleep_score}`);
    }

    if (spo2_val) {
      lines.push(`SpO2: ${spo2_val}%`);
      metrics.spo2 = spo2_val;
    }

    if (cv_age?.vascular_age) {
      lines.push(`Cardiovascular age: ${cv_age.vascular_age}`);
      metrics.cv_age = cv_age.vascular_age;
    }

    if (stress) {
      const stressed_min = stress.stress_high ? Math.round(stress.stress_high / 60) : null;
      const restored_min = stress.recovery_high ? Math.round(stress.recovery_high / 60) : null;
      if (stressed_min !== null || restored_min !== null) {
        lines.push(`Stress: ${stressed_min ?? '?'}min stressed, ${restored_min ?? '?'}min restored`);
        metrics.stress_min = stressed_min;
        metrics.restored_min = restored_min;
      }
    }
  } else {
    lines.push('No Oura data available');
  }

  lines.push('');

  // --- STRAVA ACTIVITIES (yesterday) ---
  if (strava_activities && strava_activities.length > 0) {
    // Filter to yesterday's activities
    const yesterday_activities = strava_activities.filter(a => {
      if (!a.start_date_local) return false;
      return a.start_date_local.startsWith(yesterday_str);
    });

    if (yesterday_activities.length > 0) {
      lines.push(`Yesterday's activities (${yesterday_str}):`);
      metrics.yesterday_activities = [];
      for (const a of yesterday_activities.slice(0, 5)) {
        const name = a.name || 'Activity';
        const type = a.sport_type || a.type || '';
        const dist = a.distance ? `${(a.distance / 1609.34).toFixed(1)}mi` : '';
        const elev = a.total_elevation_gain ? `${Math.round(a.total_elevation_gain * 3.281)}ft elev` : '';
        const time = a.moving_time ? `${Math.round(a.moving_time / 60)}min` : '';
        const hr = a.average_heartrate ? `avg HR ${Math.round(a.average_heartrate)}` : '';
        const parts = [type, dist, elev, time, hr].filter(Boolean).join(', ');
        lines.push(`- ${name}: ${parts}`);
        (metrics.yesterday_activities as StravaActivity[]).push({
          name, type, distance: a.distance, moving_time: a.moving_time,
          total_elevation_gain: a.total_elevation_gain,
          average_heartrate: a.average_heartrate, max_heartrate: a.max_heartrate,
        });
      }
    } else {
      lines.push('No activities recorded yesterday');
    }
  } else {
    lines.push('No Strava data available');
  }

  lines.push('');

  // --- WEIGHT & MANUAL ---
  if (manual.weight_lbs !== undefined) {
    lines.push(`Weight: ${fmt_trend(manual.weight_lbs, trends, 'weight_lbs', ' lbs')}`);
    metrics.weight = manual.weight_lbs;
  } else if (last_manual.weight_lbs !== null && last_manual.weight_date !== null) {
    const d = new Date(last_manual.weight_date * 86400000).toISOString().split('T')[0];
    lines.push(`Weight: ${last_manual.weight_lbs} lbs (last entered ${d})`);
    metrics.weight = last_manual.weight_lbs;
    metrics.weight_stale = true;
  }

  if (manual.back_pain_scale !== undefined) {
    const mobility = manual.back_mobility_notes ? `, ${manual.back_mobility_notes}` : '';
    lines.push(`Back: ${manual.back_pain_scale}/10${mobility}`);
    metrics.back_pain = manual.back_pain_scale;
  }

  if (manual.bowel_status) lines.push(`Bowel: ${manual.bowel_status}`);
  if (manual.injury_notes) lines.push(`Notes: ${manual.injury_notes}`);

  lines.push('');
  lines.push('Coach me.');

  return { injection: lines.join('\n'), metrics };
}
