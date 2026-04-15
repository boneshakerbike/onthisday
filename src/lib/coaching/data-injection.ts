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
  manual: ManualInputs
): Promise<string> {
  // Fetch all data sources in parallel
  const [oura, coros, trend_rows] = await Promise.all([
    get_wellness_cache(date_str),
    get_coros_data(date_str),
    get_trends(epoch_day),
  ]);

  const trends = new Map<string, TrendRow>();
  for (const row of trend_rows) {
    trends.set(row.metric_name, row);
  }

  const lines: string[] = [];
  lines.push(`Today's Health Data (${date_str}):`);
  lines.push('');

  // --- SLEEP & RECOVERY (Oura) ---
  lines.push('SLEEP & RECOVERY (Oura):');
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
  lines.push('PERFORMANCE (COROS):');
  if (coros) {
    const d = coros.data as Record<string, unknown>;
    // COROS data is a flexible JSON blob from the Chrome extension
    // Extract known fields if present
    if (d.vo2_max !== undefined) lines.push(`- VO2 max: ${fmt_trend(Number(d.vo2_max), trends, 'vo2_max', ' ml/kg/min')}`);
    if (d.training_load !== undefined || d.load_impact !== undefined) {
      const acute = d.training_load ?? d.load_impact ?? 'N/A';
      const chronic = d.base_fitness ?? 'N/A';
      lines.push(`- Training load: Acute ${acute}, Chronic ${chronic}`);
    }
    if (d.recovery !== undefined || d.recovery_score !== undefined) {
      lines.push(`- Recovery: ${d.recovery ?? d.recovery_score}%`);
    }
    if (d.time_to_recovery !== undefined) {
      lines.push(`- Time to full recovery: ${d.time_to_recovery}`);
    }
    if (d.seven_day_load !== undefined) {
      lines.push(`- 7-day training load: ${d.seven_day_load}`);
    }
    // Pass through any workout summary
    if (d.workout_summary) {
      lines.push(`- Last workout: ${d.workout_summary}`);
    }
    // Wellness check data
    if (d.wellness_hr !== undefined) lines.push(`- Morning HR: ${d.wellness_hr} bpm`);
    if (d.wellness_hrv !== undefined) lines.push(`- Morning HRV: ${d.wellness_hrv}ms`);
    if (d.overnight_hrv !== undefined) lines.push(`- Overnight HRV: ${d.overnight_hrv}ms`);
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
