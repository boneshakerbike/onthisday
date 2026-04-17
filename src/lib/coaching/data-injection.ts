/**
 * Data injection formatter for coaching sessions.
 * Pulls today's Oura + COROS data from existing Turso tables,
 * merges with trend_cache and manual inputs,
 * outputs the ~500-800 token prompt block.
 */

import { get_wellness_cache, get_coros_data } from '@/lib/db';
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

function as_record(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

function pick_number(obj: Record<string, unknown> | undefined, ...keys: string[]): number | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  }
  return undefined;
}

function pick_string(obj: Record<string, unknown> | undefined, ...keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim() !== '') return v;
    if (typeof v === 'number') return String(v);
  }
  return undefined;
}

function render_kv_block(label: string, obj: Record<string, unknown> | undefined, lines: string[], limit = 6): void {
  if (!obj) return;
  const entries = Object.entries(obj).filter(([, v]) =>
    v !== null && v !== undefined && (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean')
  ).slice(0, limit);
  if (entries.length === 0) return;
  const parts = entries.map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`);
  lines.push(`- ${label}: ${parts.join(', ')}`);
}

function render_coros_dashboard(
  dash: Record<string, unknown> | undefined,
  lines: string[],
): void {
  if (!dash) return;
  const ts = as_record(dash.training_status);
  if (ts) {
    if (ts.load_impact !== undefined) lines.push(`- Training load: Acute ${ts.load_impact}, Base Fitness ${ts.base_fitness ?? 'N/A'}`);
    if (ts.status) lines.push(`- Training status: ${ts.status}`);
    if (ts.intensity_trend !== undefined) lines.push(`- Intensity trend: ${ts.intensity_trend}%`);
  }
  const recovery = as_record(dash.recovery);
  if (recovery) {
    if (recovery.percentage !== undefined) lines.push(`- Recovery: ${recovery.percentage}% (${recovery.status ?? ''})`);
    if (recovery.hours_to_full_recovery !== undefined) lines.push(`- Time to full recovery: ${recovery.hours_to_full_recovery} hrs`);
  }
  const hrv = as_record(dash.overnight_hrv);
  if (hrv) {
    if (hrv.last_night_avg) lines.push(`- Overnight HRV: ${hrv.last_night_avg}ms`);
    if (hrv.normal_range) lines.push(`- HRV normal range: ${hrv.normal_range}`);
  }
  const zones = as_record(dash.threshold_hr_zones);
  if (zones?.resting_hr_bpm) lines.push(`- Resting HR (COROS): ${zones.resting_hr_bpm} bpm`);
  if (zones?.lactate_threshold_bpm) lines.push(`- Lactate threshold HR: ${zones.lactate_threshold_bpm} bpm`);
  const weekly = as_record(dash.weekly_activity);
  if (weekly?.total_distance_mi) lines.push(`- Weekly distance: ${weekly.total_distance_mi} mi`);
  const recent = dash.recent_activities as Array<Record<string, unknown>> | undefined;
  if (recent && recent.length > 0) {
    const s = recent.slice(0, 3).map(a => `${a.date}: ${a.volume} (TL: ${a.training_load})`).join('; ');
    lines.push(`- Recent activities: ${s}`);
  }
}

function render_coros_evolab(
  evolab: Record<string, unknown> | undefined,
  lines: string[],
  trends: Map<string, TrendRow>,
): void {
  if (!evolab) return;

  // Try nested shapes first (four_week/twelve_week or 4w/12w), fall back to flat evolab.
  const four = as_record(evolab.four_week) || as_record(evolab['4_week']) || as_record(evolab['4w']);
  const twelve = as_record(evolab.twelve_week) || as_record(evolab['12_week']) || as_record(evolab['12w']);

  const buckets: Array<[string, Record<string, unknown> | undefined]> = [
    ['4-week', four],
    ['12-week', twelve],
  ];
  let any_nested = false;
  for (const [label, bucket] of buckets) {
    if (!bucket) continue;
    any_nested = true;
    const vo2 = pick_number(bucket, 'vo2_max', 'vo2max');
    const hrv = pick_number(bucket, 'hrv_avg', 'hrv_average', 'avg_hrv');
    const rhr = pick_number(bucket, 'resting_hr', 'rhr', 'resting_heart_rate');
    const parts: string[] = [];
    if (vo2 !== undefined) parts.push(`VO2 ${vo2}`);
    if (hrv !== undefined) parts.push(`HRV ${hrv}ms`);
    if (rhr !== undefined) parts.push(`RHR ${rhr}bpm`);
    if (parts.length > 0) lines.push(`- Evolab ${label}: ${parts.join(', ')}`);
    render_kv_block(`Evolab ${label} intensity`, as_record(bucket.intensity_distribution), lines);
    render_kv_block(`Evolab ${label} zones`, as_record(bucket.zone_distribution) || as_record(bucket.zones), lines);
  }

  if (!any_nested) {
    // Flat evolab — pull top-level metrics.
    const vo2 = pick_number(evolab, 'vo2_max', 'vo2max');
    const hrv = pick_number(evolab, 'hrv_avg', 'hrv_average', 'avg_hrv');
    const rhr = pick_number(evolab, 'resting_hr', 'rhr', 'resting_heart_rate');
    if (vo2 !== undefined) lines.push(`- Evolab VO2 max: ${fmt_trend(vo2, trends, 'vo2_max', ' ml/kg/min')}`);
    if (hrv !== undefined) lines.push(`- Evolab HRV avg: ${hrv}ms`);
    if (rhr !== undefined) lines.push(`- Evolab resting HR: ${rhr} bpm`);
    render_kv_block('Evolab intensity', as_record(evolab.intensity_distribution), lines);
    render_kv_block('Evolab zones', as_record(evolab.zone_distribution) || as_record(evolab.zones), lines);
  }
}

function render_coros_activities(activities: Array<Record<string, unknown>>, lines: string[]): void {
  const cap = Math.min(activities.length, 5);
  lines.push(`- Activities (${cap} of ${activities.length}):`);
  for (let i = 0; i < cap; i++) {
    const a = activities[i];
    const title = pick_string(a, 'title', 'name') ?? 'Activity';
    const type = pick_string(a, 'type', 'sport') ?? '';
    const ts = pick_string(a, 'timestamp', 'date', 'start_time') ?? '';
    const summary = pick_string(a, 'summary');
    const eff = pick_number(a, 'efficiency');
    const ate = pick_number(a, 'aerobic_te', 'aerobic_training_effect');
    const nte = pick_number(a, 'anaerobic_te', 'anaerobic_training_effect');
    const head_parts = [title, type, ts].filter(Boolean).join(' · ');
    const tail_parts: string[] = [];
    if (eff !== undefined) tail_parts.push(`eff ${eff}`);
    if (ate !== undefined) tail_parts.push(`aTE ${ate}`);
    if (nte !== undefined) tail_parts.push(`anTE ${nte}`);
    const zones = as_record(a.zones);
    if (zones) {
      const ze = Object.entries(zones).filter(([, v]) => typeof v === 'number' || typeof v === 'string').slice(0, 5);
      if (ze.length) tail_parts.push('zones ' + ze.map(([k, v]) => `${k}:${v}`).join('/'));
    }
    const exercises = a.exercises as Array<unknown> | undefined;
    if (Array.isArray(exercises) && exercises.length > 0) tail_parts.push(`${exercises.length} exercises`);
    let line = `  · ${head_parts}`;
    if (tail_parts.length) line += ` — ${tail_parts.join(', ')}`;
    if (summary) line += ` — ${summary.slice(0, 160)}`;
    lines.push(line);
  }
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

  const [oura_initial, coros_initial, trend_rows, last_manual] = await Promise.all([
    get_wellness_cache(date_str),
    get_coros_data(date_str),
    get_trends(epoch_day),
    get_last_known_manual_metrics(),
  ]);
  let oura = oura_initial;
  let coros = coros_initial;

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
    const before = lines.length;

    // Dashboard (Chrome extension Training Hub scrape)
    render_coros_dashboard(d.dashboard as Record<string, unknown> | undefined, lines);

    // Evolab (multi-week training metrics: VO2 max, HRV, RHR, zone/intensity distributions)
    render_coros_evolab(d.evolab as Record<string, unknown> | undefined, lines, trends);

    // Activities (per-activity detail: title, type, timestamp, summary, zones, TE)
    const activities = d.activities as Array<Record<string, unknown>> | undefined;
    if (activities && activities.length > 0) {
      render_coros_activities(activities, lines);
    }

    // Flat fallback for older data shapes
    if (!d.dashboard && !d.evolab && !activities) {
      if (d.vo2_max !== undefined) lines.push(`- VO2 max: ${fmt_trend(Number(d.vo2_max), trends, 'vo2_max', ' ml/kg/min')}`);
      if (d.recovery !== undefined) lines.push(`- Recovery: ${d.recovery}%`);
      if (d.training_load !== undefined) lines.push(`- Training load: ${d.training_load}`);
    }

    // Report markdown: included only if structured rendering produced nothing,
    // or appended as a trimmed narrative if present. Keeps token budget bounded.
    const report_md = typeof d.report_markdown === 'string' ? (d.report_markdown as string) : '';
    if (report_md) {
      const wrote_structured = lines.length > before;
      const budget = wrote_structured ? 1200 : 2500;
      const trimmed = report_md.length > budget ? report_md.slice(0, budget) + '…(truncated)' : report_md;
      lines.push('');
      lines.push('COROS briefing:');
      lines.push(trimmed);
    }

    if (lines.length === before) {
      lines.push('- COROS data present but no recognised fields');
    }
  } else {
    lines.push('- No COROS data available for today');
  }

  lines.push('');

  // --- BODY COMPOSITION (Manual) ---
  lines.push('BODY COMPOSITION (Manual):');
  if (manual.weight_lbs !== undefined) {
    lines.push(`- Weight: ${fmt_trend(manual.weight_lbs, trends, 'weight_lbs', ' lbs')}`);
  } else if (last_manual.weight_lbs !== null && last_manual.weight_date !== null) {
    const weight_date_str = new Date(last_manual.weight_date * 86400000).toISOString().split('T')[0];
    lines.push(`- Weight: ${fmt_trend(last_manual.weight_lbs, trends, 'weight_lbs', ' lbs')} (last entered ${weight_date_str})`);
  } else {
    lines.push('- Weight: not entered');
  }

  if (manual.back_pain_scale !== undefined) {
    const mobility = manual.back_mobility_notes ? `, ${manual.back_mobility_notes}` : '';
    lines.push(`- Back status: ${manual.back_pain_scale}/10 pain${mobility}`);
  } else if (last_manual.back_pain_scale !== null && last_manual.back_pain_date !== null) {
    const back_date_str = new Date(last_manual.back_pain_date * 86400000).toISOString().split('T')[0];
    lines.push(`- Back status: ${last_manual.back_pain_scale}/10 pain (last entered ${back_date_str})`);
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
