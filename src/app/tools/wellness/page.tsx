/**
 * Wellness Dashboard - Oura Ring daily scores (POC)
 * Shows sleep, readiness, and activity data
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import NavTabs from '@/components/nav_tabs';

interface WellnessData {
  date: string;
  sleep: Record<string, unknown> | null;
  readiness: Record<string, unknown> | null;
  activity: Record<string, unknown> | null;
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
  const [is_localhost, set_is_localhost] = useState(false);
  const [connected, set_connected] = useState<boolean | null>(null);
  const [loading, set_loading] = useState(true);
  const [data, set_data] = useState<WellnessData | null>(null);
  const [selected_date, set_selected_date] = useState(new Date().toLocaleDateString('en-CA'));
  const [error, set_error] = useState<string | null>(null);
  const [show_raw, set_show_raw] = useState<string | null>(null);
  const [toast, set_toast] = useState<string | null>(null);

  const search_params = useSearchParams();

  useEffect(() => {
    set_is_localhost(window.location.hostname === 'localhost');

    // Check for OAuth redirect messages
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

  function render_score_card(
    title: string,
    key: string,
    icon: string,
    score_field: string,
    detail_fields: [string, string][],
  ) {
    const section = data?.[key as keyof WellnessData] as Record<string, unknown> | null;
    const score = section?.[score_field] as number | null | undefined;
    const contributors = section?.contributors as Record<string, unknown> | undefined;

    return (
      <div className={`p-5 border rounded-lg ${score_bg(score)}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <h3 className="font-medium text-gray-200">{title}</h3>
          </div>
          {section && (
            <button
              onClick={() => set_show_raw(show_raw === key ? null : key)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-all"
            >
              {show_raw === key ? 'Hide' : 'Raw'}
            </button>
          )}
        </div>

        {!section ? (
          <p className="text-gray-500 text-sm">No data for this date</p>
        ) : (
          <>
            <div className={`text-4xl font-bold mb-3 ${score_color(score)}`}>
              {score ?? '—'}
            </div>

            {contributors && (
              <div className="space-y-1">
                {detail_fields.map(([field, label]) => {
                  const val = contributors[field] as number | undefined;
                  return val != null ? (
                    <div key={field} className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">{label}</span>
                      <span className={score_color(val)}>{val}</span>
                    </div>
                  ) : null;
                })}
              </div>
            )}

            {/* Extra fields for activity */}
            {key === 'activity' && (
              <div className="space-y-1 mt-2 pt-2 border-t border-white/10">
                {section.steps != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Steps</span>
                    <span className="text-gray-200">{(section.steps as number).toLocaleString()}</span>
                  </div>
                )}
                {section.active_calories != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Active Calories</span>
                    <span className="text-gray-200">{section.active_calories as number}</span>
                  </div>
                )}
                {section.total_calories != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Total Calories</span>
                    <span className="text-gray-200">{section.total_calories as number}</span>
                  </div>
                )}
              </div>
            )}

            {show_raw === key && (
              <pre className="mt-3 p-3 bg-black/30 rounded text-xs text-gray-400 overflow-x-auto max-h-[300px] overflow-y-auto">
                {JSON.stringify(section, null, 2)}
              </pre>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] text-white">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <NavTabs is_localhost={is_localhost} />

        {/* Toast */}
        {toast && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-sm text-green-400 text-center">
            {toast}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-400 text-center">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-cyan-400 mb-2">Wellness</h1>
            <p className="text-gray-400 text-sm">Daily scores from Oura Ring</p>
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
          /* Not connected state */
          <div className="text-center py-16 border border-white/10 rounded-lg">
            <div className="text-4xl mb-4">💍</div>
            <h2 className="text-lg font-medium text-gray-200 mb-2">Connect Your Oura Ring</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
              Link your Oura account to see daily sleep, readiness, and activity scores.
            </p>
            <a
              href="/api/oura/authorize"
              className="inline-block px-6 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-medium transition-all"
            >
              Connect Oura Ring
            </a>
          </div>
        ) : (
          /* Connected - show data */
          <>
            {/* Date picker */}
            <div className="mb-6">
              <input
                type="date"
                value={selected_date}
                onChange={(e) => handle_date_change(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-400/30"
              />
            </div>

            {/* Score cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {render_score_card('Sleep', 'sleep', '😴', 'score', [
                ['deep_sleep', 'Deep Sleep'],
                ['efficiency', 'Efficiency'],
                ['restfulness', 'Restfulness'],
                ['latency', 'Latency'],
                ['timing', 'Timing'],
                ['rem_sleep', 'REM Sleep'],
                ['total_sleep', 'Total Sleep'],
              ])}
              {render_score_card('Readiness', 'readiness', '⚡', 'score', [
                ['activity_balance', 'Activity Balance'],
                ['body_temperature', 'Body Temp'],
                ['hrv_balance', 'HRV Balance'],
                ['previous_day_activity', 'Prev Activity'],
                ['previous_night', 'Prev Night'],
                ['recovery_index', 'Recovery'],
                ['resting_heart_rate', 'Resting HR'],
                ['sleep_balance', 'Sleep Balance'],
              ])}
              {render_score_card('Activity', 'activity', '🏃', 'score', [
                ['meet_daily_targets', 'Daily Targets'],
                ['move_every_hour', 'Hourly Movement'],
                ['recovery_time', 'Recovery Time'],
                ['stay_active', 'Stay Active'],
                ['training_frequency', 'Training Freq'],
                ['training_volume', 'Training Volume'],
              ])}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
