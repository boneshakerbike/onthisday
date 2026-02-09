/**
 * Wellness Dashboard - Oura Ring comprehensive wellness data
 * Sections: Scores, Body Signals, Sleep Details, Activity, Workouts, Sessions
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import NavTabs from '@/components/nav_tabs';

interface WellnessData {
  date: string;
  cached?: boolean;
  sleep: Record<string, unknown> | null;
  readiness: Record<string, unknown> | null;
  activity: Record<string, unknown> | null;
  stress: Record<string, unknown> | null;
  resilience: Record<string, unknown> | null;
  cardiovascular_age: Record<string, unknown> | null;
  spo2: Record<string, unknown> | null;
  sleep_detail: Record<string, unknown>[] | null;
  heartrate: Record<string, unknown>[] | null;
  vo2_max: Record<string, unknown> | null;
  workouts: Record<string, unknown>[] | null;
  sessions: Record<string, unknown>[] | null;
  scores: {
    sleep: number | null;
    readiness: number | null;
    activity: number | null;
    stress_high: number | null;
    recovery_high: number | null;
    hrv_average: number | null;
    resting_hr: number | null;
    spo2_average: number | null;
    steps: number | null;
    active_calories: number | null;
  };
}

function score_color(score: number | null | undefined): string {
  if (score == null) return 'text-gray-500';
  if (score >= 85) return 'text-green-400';
  if (score >= 70) return 'text-yellow-400';
  return 'text-red-400';
}

function score_bg(score: number | null | undefined): string {
  if (score == null) return 'border-gray-500/30';
  if (score >= 85) return 'border-green-400/30 bg-green-400/5';
  if (score >= 70) return 'border-yellow-400/30 bg-yellow-400/5';
  return 'border-red-400/30 bg-red-400/5';
}

function format_duration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function format_minutes(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function WellnessPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] text-white">
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          <div className="text-center text-gray-500 py-12">Loading...</div>
        </div>
      </main>
    }>
      <WellnessContent />
    </Suspense>
  );
}

function WellnessContent() {
  const [connected, set_connected] = useState<boolean | null>(null);
  const [loading, set_loading] = useState(true);
  const [syncing, set_syncing] = useState(false);
  const [data, set_data] = useState<WellnessData | null>(null);
  const [selected_date, set_selected_date] = useState(new Date().toLocaleDateString('en-CA'));
  const [error, set_error] = useState<string | null>(null);
  const [show_raw, set_show_raw] = useState<string | null>(null);
  const [expanded, set_expanded] = useState<Record<string, boolean>>({});
  const [toast, set_toast] = useState<string | null>(null);

  const search_params = useSearchParams();

  useEffect(() => {
    document.title = '8i11 | Wellness';
    const connected_param = search_params.get('connected');
    const error_param = search_params.get('error');
    if (connected_param === 'true') {
      set_toast('Oura Ring connected!');
      setTimeout(() => set_toast(null), 4000);
    }
    if (error_param) {
      set_error(`Connection failed: ${error_param}`);
    }
    fetch_data(new Date().toLocaleDateString('en-CA'));
  }, [search_params]);

  async function fetch_data(date: string) {
    set_loading(true);
    set_error(null);
    try {
      const res = await fetch(`/api/oura/data?date=${date}`);
      const json = await res.json();
      if (json.connected === false) {
        set_connected(false);
        set_data(null);
      } else if (json.success) {
        set_connected(true);
        set_data(json);
      } else {
        set_error(json.error || 'Unknown error');
      }
    } catch (err) {
      set_error('Failed to fetch wellness data');
      console.error(err);
    } finally {
      set_loading(false);
    }
  }

  async function handle_sync() {
    set_syncing(true);
    try {
      const res = await fetch('/api/oura/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }),
      });
      const json = await res.json();
      if (json.success) {
        set_toast(`Synced ${json.synced} day${json.synced !== 1 ? 's' : ''}${json.skipped ? `, ${json.skipped} already cached` : ''}`);
      } else {
        set_toast(`Sync error: ${json.error}`);
      }
    } catch {
      set_toast('Sync failed');
    } finally {
      set_syncing(false);
      setTimeout(() => set_toast(null), 4000);
    }
  }

  async function handle_disconnect() {
    if (!confirm('Disconnect your Oura Ring account?')) return;
    try {
      await fetch('/api/oura/disconnect', { method: 'DELETE' });
      set_connected(false);
      set_data(null);
      set_toast('Oura Ring disconnected');
      setTimeout(() => set_toast(null), 3000);
    } catch (err) {
      console.error('Disconnect failed:', err);
    }
  }

  function handle_date_change(date: string) {
    set_selected_date(date);
    fetch_data(date);
  }

  function toggle_section(key: string) {
    set_expanded(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const scores = data?.scores;
  const sleep_period = Array.isArray(data?.sleep_detail) ? data.sleep_detail[0] : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] text-white">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <NavTabs />

        {toast && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-sm text-green-400 text-center">
            {toast}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-400 text-center">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-cyan-400 mb-2">Wellness</h1>
            <p className="text-gray-400 text-sm">Oura Ring wellness data</p>
          </div>
          {connected && (
            <button
              onClick={handle_disconnect}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-red-400 border border-white/10 hover:border-red-400/30 rounded transition-all"
            >
              Disconnect
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading...</div>
        ) : connected === false ? (
          <div className="text-center py-16 border border-white/10 rounded-lg">
            <div className="text-4xl mb-4">🚴</div>
            <h2 className="text-lg font-medium text-gray-200 mb-2">Connect Your Oura Ring</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
              Link your Oura account to see sleep, readiness, activity, stress, HRV, and more.
            </p>
            <a
              href="/api/oura/authorize"
              className="inline-block px-6 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-medium transition-all"
            >
              Connect Oura Ring
            </a>
          </div>
        ) : (
          <>
            {/* Date picker + Sync */}
            <div className="mb-6 flex items-center gap-3 flex-wrap">
              <input
                type="date"
                value={selected_date}
                onChange={(e) => handle_date_change(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-400/30"
              />
              <button
                onClick={handle_sync}
                disabled={syncing}
                className="px-4 py-2 text-sm bg-white/5 border border-white/10 rounded-lg hover:border-cyan-400/30 hover:text-cyan-400 disabled:opacity-50 transition-all"
              >
                {syncing ? 'Syncing...' : 'Sync 7 Days'}
              </button>
              {data?.cached && (
                <span className="text-xs text-gray-500">cached</span>
              )}
            </div>

            {/* === Section 1: Daily Scores === */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Sleep', icon: '😴', score: scores?.sleep },
                { label: 'Readiness', icon: '⚡', score: scores?.readiness },
                { label: 'Activity', icon: '🏃', score: scores?.activity },
              ].map(({ label, icon, score }) => (
                <div key={label} className={`p-4 border rounded-lg text-center ${score_bg(score)}`}>
                  <div className="text-lg mb-1">{icon}</div>
                  <div className={`text-3xl font-bold ${score_color(score)}`}>{score ?? '—'}</div>
                  <div className="text-xs text-gray-400 mt-1">{label}</div>
                </div>
              ))}
            </div>

            {/* === Section 2: Body Signals === */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <SignalCard label="HRV" value={scores?.hrv_average} unit="ms" icon="💓" />
              <SignalCard label="Resting HR" value={scores?.resting_hr} unit="bpm" icon="❤️" />
              <SignalCard label="SpO2" value={scores?.spo2_average} unit="%" icon="🫁" />
              <SignalCard label="Steps" value={scores?.steps ? scores.steps.toLocaleString() : null} icon="👟" />
              <SignalCard
                label="Stress"
                value={scores?.stress_high != null ? format_minutes(scores.stress_high) : null}
                sublabel="high stress"
                icon="😤"
              />
              <SignalCard
                label="Recovery"
                value={scores?.recovery_high != null ? format_minutes(scores.recovery_high) : null}
                sublabel="restorative"
                icon="🧘"
              />
              <SignalCard
                label="Resilience"
                value={data?.resilience ? String((data.resilience as Record<string, unknown>).level || '—') : null}
                icon="🛡️"
              />
              <SignalCard
                label="Cardio Age"
                value={data?.cardiovascular_age ? (data.cardiovascular_age as Record<string, unknown>).vascular_age as number : null}
                unit="yrs"
                icon="🫀"
              />
              <SignalCard
                label="VO2 Max"
                value={data?.vo2_max ? (data.vo2_max as Record<string, unknown>).vo2_max as number : null}
                icon="🏔️"
              />
              <SignalCard
                label="Calories"
                value={scores?.active_calories != null ? `${scores.active_calories}` : null}
                sublabel="active"
                icon="🔥"
              />
            </div>

            {/* === Section 3: Sleep Details (expandable) === */}
            {sleep_period && (
              <CollapsibleSection
                title="Sleep Details"
                icon="🌙"
                expanded={expanded.sleep_details}
                on_toggle={() => toggle_section('sleep_details')}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <DetailItem label="Total Sleep" value={format_duration(sleep_period.total_sleep_duration as number)} />
                  <DetailItem label="Deep Sleep" value={format_duration(sleep_period.deep_sleep_duration as number)} />
                  <DetailItem label="REM Sleep" value={format_duration(sleep_period.rem_sleep_duration as number)} />
                  <DetailItem label="Light Sleep" value={format_duration(sleep_period.light_sleep_duration as number)} />
                  <DetailItem label="Awake Time" value={format_duration(sleep_period.awake_time as number)} />
                  <DetailItem label="Efficiency" value={sleep_period.efficiency != null ? `${sleep_period.efficiency}%` : '—'} />
                  <DetailItem label="Avg HR" value={sleep_period.average_heart_rate != null ? `${sleep_period.average_heart_rate} bpm` : '—'} />
                  <DetailItem label="Avg HRV" value={sleep_period.average_hrv != null ? `${sleep_period.average_hrv} ms` : '—'} />
                  <DetailItem label="Avg Breath" value={sleep_period.average_breath != null ? `${(sleep_period.average_breath as number).toFixed(1)} /min` : '—'} />
                  <DetailItem label="Lowest HR" value={sleep_period.lowest_heart_rate != null ? `${sleep_period.lowest_heart_rate} bpm` : '—'} />
                  <DetailItem label="Latency" value={format_duration(sleep_period.latency as number)} />
                  <DetailItem label="Restless" value={sleep_period.restless_periods != null ? `${sleep_period.restless_periods}` : '—'} />
                </div>
              </CollapsibleSection>
            )}

            {/* === Section 4: Activity Details (expandable) === */}
            {data?.activity && (
              <CollapsibleSection
                title="Activity Details"
                icon="🏃"
                expanded={expanded.activity_details}
                on_toggle={() => toggle_section('activity_details')}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <DetailItem label="Steps" value={data.activity.steps != null ? (data.activity.steps as number).toLocaleString() : '—'} />
                  <DetailItem label="Active Cal" value={data.activity.active_calories != null ? `${data.activity.active_calories}` : '—'} />
                  <DetailItem label="Total Cal" value={data.activity.total_calories != null ? `${data.activity.total_calories}` : '—'} />
                  <DetailItem label="Sedentary" value={format_minutes(data.activity.sedentary_time as number)} />
                  <DetailItem label="High Activity" value={format_minutes(data.activity.high_activity_time as number)} />
                  <DetailItem label="Medium Activity" value={format_minutes(data.activity.medium_activity_time as number)} />
                  <DetailItem label="Low Activity" value={format_minutes(data.activity.low_activity_time as number)} />
                  <DetailItem label="Walking Equiv" value={data.activity.equivalent_walking_distance != null ? `${((data.activity.equivalent_walking_distance as number) / 1000).toFixed(1)} km` : '—'} />
                  <DetailItem label="Inactivity Alerts" value={data.activity.inactivity_alerts != null ? `${data.activity.inactivity_alerts}` : '—'} />
                </div>
              </CollapsibleSection>
            )}

            {/* === Section 5: Score Contributors (expandable) === */}
            <CollapsibleSection
              title="Score Contributors"
              icon="📊"
              expanded={expanded.contributors}
              on_toggle={() => toggle_section('contributors')}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Sleep contributors */}
                <ContributorCard
                  title="Sleep"
                  data={data?.sleep}
                  fields={[
                    ['deep_sleep', 'Deep Sleep'], ['efficiency', 'Efficiency'], ['restfulness', 'Restfulness'],
                    ['latency', 'Latency'], ['timing', 'Timing'], ['rem_sleep', 'REM Sleep'], ['total_sleep', 'Total Sleep'],
                  ]}
                />
                {/* Readiness contributors */}
                <ContributorCard
                  title="Readiness"
                  data={data?.readiness}
                  fields={[
                    ['activity_balance', 'Activity Balance'], ['body_temperature', 'Body Temp'],
                    ['hrv_balance', 'HRV Balance'], ['previous_day_activity', 'Prev Activity'],
                    ['previous_night', 'Prev Night'], ['recovery_index', 'Recovery'],
                    ['resting_heart_rate', 'Resting HR'], ['sleep_balance', 'Sleep Balance'],
                  ]}
                />
                {/* Activity contributors */}
                <ContributorCard
                  title="Activity"
                  data={data?.activity}
                  fields={[
                    ['meet_daily_targets', 'Daily Targets'], ['move_every_hour', 'Hourly Movement'],
                    ['recovery_time', 'Recovery Time'], ['stay_active', 'Stay Active'],
                    ['training_frequency', 'Training Freq'], ['training_volume', 'Training Volume'],
                  ]}
                />
              </div>
            </CollapsibleSection>

            {/* === Section 6: Workouts (conditional) === */}
            {data?.workouts && (data.workouts as Record<string, unknown>[]).length > 0 && (
              <CollapsibleSection
                title={`Workouts (${(data.workouts as Record<string, unknown>[]).length})`}
                icon="💪"
                expanded={expanded.workouts ?? true}
                on_toggle={() => toggle_section('workouts')}
              >
                <div className="space-y-3">
                  {(data.workouts as Record<string, unknown>[]).map((w, i) => (
                    <div key={i} className="p-3 bg-white/5 border border-white/10 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-200">{(w.activity as string) || 'Workout'}</span>
                        <span className="text-xs text-gray-500">{w.intensity as string}</span>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-400">
                        {w.calories != null ? <span>{w.calories as number} cal</span> : null}
                        {w.distance != null ? <span>{((w.distance as number) / 1000).toFixed(1)} km</span> : null}
                        {(w.start_datetime && w.end_datetime) ? (
                          <span>{format_duration(
                            (new Date(String(w.end_datetime)).getTime() - new Date(String(w.start_datetime)).getTime()) / 1000
                          )}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* === Section 7: Sessions (conditional) === */}
            {data?.sessions && (data.sessions as Record<string, unknown>[]).length > 0 && (
              <CollapsibleSection
                title={`Sessions (${(data.sessions as Record<string, unknown>[]).length})`}
                icon="🧘"
                expanded={expanded.sessions ?? true}
                on_toggle={() => toggle_section('sessions')}
              >
                <div className="space-y-3">
                  {(data.sessions as Record<string, unknown>[]).map((s, i) => (
                    <div key={i} className="p-3 bg-white/5 border border-white/10 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-200">{(s.type as string) || 'Session'}</span>
                        {s.mood ? <span className="text-xs text-gray-400">Mood: {String(s.mood)}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Raw data toggle */}
            <div className="mt-6">
              <button
                onClick={() => set_show_raw(show_raw ? null : 'all')}
                className="text-xs text-gray-500 hover:text-gray-300 transition-all"
              >
                {show_raw ? 'Hide Raw Data' : 'Show Raw Data'}
              </button>
              {show_raw && data && (
                <pre className="mt-3 p-4 bg-black/30 rounded-lg text-xs text-gray-400 overflow-x-auto max-h-[400px] overflow-y-auto">
                  {JSON.stringify(data, null, 2)}
                </pre>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// ── Subcomponents ──

function SignalCard({ label, value, unit, sublabel, icon }: {
  label: string;
  value: number | string | null | undefined;
  unit?: string;
  sublabel?: string;
  icon: string;
}) {
  return (
    <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="text-lg font-semibold text-gray-200">
        {value != null ? (
          <>{value}{unit && <span className="text-xs text-gray-400 ml-1">{unit}</span>}</>
        ) : '—'}
      </div>
      {sublabel && <div className="text-xs text-gray-500">{sublabel}</div>}
    </div>
  );
}

function CollapsibleSection({ title, icon, expanded, on_toggle, children }: {
  title: string;
  icon: string;
  expanded?: boolean;
  on_toggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <button
        onClick={on_toggle}
        className="w-full flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
      >
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-sm">{icon}</span>
        <span className="text-sm font-medium text-gray-200">{title}</span>
      </button>
      {expanded && (
        <div className="mt-2 p-4 bg-white/5 border border-white/10 rounded-lg">
          {children}
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-200">{value}</div>
    </div>
  );
}

function ContributorCard({ title, data, fields }: {
  title: string;
  data: Record<string, unknown> | null | undefined;
  fields: [string, string][];
}) {
  const contributors = data?.contributors as Record<string, unknown> | undefined;
  if (!contributors) return null;

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-300 mb-2">{title}</h4>
      <div className="space-y-1">
        {fields.map(([field, label]) => {
          const val = contributors[field] as number | undefined;
          return val != null ? (
            <div key={field} className="flex items-center justify-between text-sm">
              <span className="text-gray-400">{label}</span>
              <span className={score_color(val)}>{val}</span>
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
}
