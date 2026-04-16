/**
 * Data injection formatter for coaching sessions.
 * Pulls today's Oura + COROS data from existing Turso tables,
 * merges with trend_cache and manual inputs,
 * outputs the ~500-800 token prompt block.
 */

import { get_wellness_cache, get_coros_data } from '@/lib/db';
import { get_trends, type TrendRow } from '@/lib/coaching/db';

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
  coros_live?: Record<string, unknown> | null
): Promise<string> {
  // Fetch all data sources in parallel
  const yesterday = new Date(date_str + 'T12:00:00');
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterday_str = yesterday.toISOString().split('T')[0];

  let [oura, coros, trend_rows] = await Promise.all([
    get_wellness_cache(date_str),
    get_coros_data(date_str),
    get_trends(epoch_day),
  ]);

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
      steps: (scores?.steps as number) ?? null,
      active_calories: (scores?.active_calories as number) ?? null,
      daily_sleep: daily_sleep ?? null,
      daily_readiness: readiness ?? null,
      daily_activity: null,
      daily_stress: null,
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

  // If live COROS data was passed from the client, use it over cache
  if (coros_live && coros_live.data) {
    coros = {
      date: (coros_live.date as string) ?? date_str,
      data: coros_live.data,
      source: 'live',
      created_at: '',
      updated_at: '',
    };
  }

  // Fall back to yesterday's cached data if still empty
  if (!oura || !coros) {
    const [oura_y, coros_y] = await Promise.all([
      !oura ? get_wellness_cache(yesterday_str) : Promise.resolve(oura),
      !coros ? get_coros_data(yesterday_str) : Promise.resolve(coros),
    ]);
    oura = oura_y;
    coros = coros_y;
  }

  const trends = new Map<string, TrendRow>();
  for (const row of trend_rows) {
    trends.set(row.metric_name, row);
  }

  const lines: string[] = [];
  lines.push(`Today's Health Data (${date_str}):`);
  lines.push('');

  // --- SLEEP & RECOVERY (Oura) ---
  const oura_label = oura?.date === yesterday_str ? `Oura — using ${yesterday_str} data` : 'Oura';
  lines.push(`SLEEP & RECOVERY (${oura_label}):`);
  if (oura) {
    const sleep = oura.daily_sleep as OuraSleepDetail | null;
    const readiness = oura.daily_readiness as OuraReadinessDetail | null;
    const cv_age = oura.daily_cardiovascular_age as OuraCardiovascularAge | null;

    if (sleep) {
      const duration = sleep.total_sleep_duration ? seconds_to_hm(sleep.total_sleep_duration) : 'N/A';
      const efficiency = sleep.efficiency ? `${sleep.efficiency}%` : 'N/A';
      const deep = sleep.deep_sleep_duration ? seconds_to_hm(sleep.deep_sleep_duration) : 'N/A';
      const rem = sleep.rem_sleep_duration ? seconds_to_hm(sleep.rem_sleep_duration) : 'N/A';
      lines.push(`- Sleep: ${duration} (efficiency ${efficiency}, deep ${deep}, REM ${rem})`);
    } else {
      lines.push(`- Sleep score: ${oura.sleep_score ?? 'N/A'}`);
    }

    lines.push(`- HRV: ${fmt_trend(oura.hrv_average, trends, 'hrv_rmssd', 'ms')}`);
    lines.push(`- Resting HR: ${fmt_trend(oura.resting_hr, trends, 'resting_hr', ' bpm')}`);
    lines.push(`- Readiness: ${readiness?.score ?? oura.readiness_score ?? 'N/A'}/100`);

    if (cv_age?.vascular_age) {
      lines.push(`- Cardiovascular age: ${cv_age.vascular_age}`);
    }
  } else {
    lines.push('- No Oura data available for today');
  }

  lines.push('');

  // --- PERFORMANCE (COROS) ---
  const coros_label = coros && (coros as { date: string }).date === yesterday_str ? `COROS — using ${yesterday_str} data` : 'COROS';
  lines.push(`PERFORMANCE (${coros_label}):`);
  if (coros) {
    const d = coros.data as Record<string, unknown>;
    // COROS data comes from Chrome extension scrape of Training Hub
    // Structure: { dashboard: { training_status, overnight_hrv, ... }, report_markdown }
    const dash = d.dashboard as Record<string, unknown> | undefined;
    const ts = dash?.training_status as Record<string, unknown> | undefined;
    const hrv = dash?.overnight_hrv as Record<string, unknown> | undefined;
    const activities = dash?.recent_activities as Array<Record<string, unknown>> | undefined;

    // Training status
    if (ts) {
      if (ts.load_impact !== undefined) {
        lines.push(`- Training load: Acute ${ts.load_impact}, Base Fitness ${ts.base_fitness ?? 'N/A'}`);
      }
      if (ts.status) lines.push(`- Training status: ${ts.status}`);
      if (ts.intensity_trend !== undefined) lines.push(`- Intensity trend: ${ts.intensity_trend}%`);
    }

    // Recovery
    const recovery = dash?.recovery as Record<string, unknown> | undefined;
    if (recovery) {
      if (recovery.percentage !== undefined) lines.push(`- Recovery: ${recovery.percentage}% (${recovery.status ?? ''})`);
      if (recovery.hours_to_full_recovery !== undefined) lines.push(`- Time to full recovery: ${recovery.hours_to_full_recovery} hrs`);
    }

    // Overnight HRV
    if (hrv) {
      if (hrv.last_night_avg) lines.push(`- Overnight HRV: ${hrv.last_night_avg}ms`);
      if (hrv.normal_range) lines.push(`- HRV normal range: ${hrv.normal_range}`);
    }

    // Resting HR and threshold from dashboard
    const zones = dash?.threshold_hr_zones as Record<string, unknown> | undefined;
    if (zones?.resting_hr_bpm) lines.push(`- Resting HR (COROS): ${zones.resting_hr_bpm} bpm`);
    if (zones?.lactate_threshold_bpm) lines.push(`- Lactate threshold HR: ${zones.lactate_threshold_bpm} bpm`);

    // Weekly activity summary
    const weekly = dash?.weekly_activity as Record<string, unknown> | undefined;
    if (weekly?.total_distance_mi) lines.push(`- Weekly distance: ${weekly.total_distance_mi} mi`);

    // Recent activities summary (last 3)
    if (activities && activities.length > 0) {
      const recent = activities.slice(0, 3).map(a =>
        `${a.date}: ${a.volume} (TL: ${a.training_load})`
      ).join('; ');
      lines.push(`- Recent activities: ${recent}`);
    }

    // Fall back to flat field names for older data formats
    if (!dash) {
      if (d.vo2_max !== undefined) lines.push(`- VO2 max: ${fmt_trend(Number(d.vo2_max), trends, 'vo2_max', ' ml/kg/min')}`);
      if (d.recovery !== undefined) lines.push(`- Recovery: ${d.recovery}%`);
      if (d.training_load !== undefined) lines.push(`- Training load: ${d.training_load}`);
    }
  } else {
    lines.push('- No COROS data available for today');
  }

  lines.push('');

  // --- BODY COMPOSITION (Manual) ---
  lines.push('BODY COMPOSITION (Manual):');
  if (manual.weight_lbs !== undefined) {
    lines.push(`- Weight: ${fmt_trend(manual.weight_lbs, trends, 'weight_lbs', ' lbs')}`);
  } else {
    lines.push('- Weight: not entered');
  }

  if (manual.back_pain_scale !== undefined) {
    const mobility = manual.back_mobility_notes ? `, ${manual.back_mobility_notes}` : '';
    lines.push(`- Back status: ${manual.back_pain_scale}/10 pain${mobility}`);
  } else {
    lines.push('- Back status: not entered');
  }

  if (manual.bowel_status) {
    lines.push(`- Bowel: ${manual.bowel_status}`);
  }

  if (manual.injury_notes) {
    lines.push(`- Injuries/notes: ${manual.injury_notes}`);
  }

  lines.push('');
  lines.push('What coaching advice do you have for me today?');

  return lines.join('\n');
}
