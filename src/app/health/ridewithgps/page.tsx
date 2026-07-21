/**
 * Ride with GPS Dashboard - recent activities
 * Static Basic Auth credentials — no connect/disconnect flow, no per-user
 * connection state. If the fetch fails, show an error banner + retry.
 */

'use client';

import { useState, useEffect } from 'react';
import NavTabs from '@/components/nav_tabs';
import type { RwgpsActivity } from '@/lib/ridewithgps';

function activity_icon(type: string | undefined): string {
  const t = (type || '').toLowerCase();
  if (t.includes('mountain')) return '🚵';
  if (t.includes('gravel') || t.includes('road') || t.includes('cycling') || t.includes('ride')) return '🚴';
  if (t.includes('hik')) return '🥾';
  if (t.includes('walk')) return '🚶';
  if (t.includes('run')) return '🏃';
  if (t.includes('strength') || t.includes('workout')) return '🏋️';
  if (t.includes('swim')) return '🏊';
  if (t.includes('yoga')) return '🧘';
  return '🏅';
}

function format_duration(seconds: number | null | undefined): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function meters_to_miles(m: number | null | undefined): string | null {
  if (!m) return null;
  return (m / 1609.344).toFixed(1) + ' mi';
}

function meters_to_feet(m: number | null | undefined): string | null {
  if (!m) return null;
  return Math.round(m * 3.28084).toLocaleString() + ' ft';
}

function format_date(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return '—'; }
}

export default function RideWithGpsPage() {
  const [loading, set_loading] = useState(true);
  const [refreshing, set_refreshing] = useState(false);
  const [activities, set_activities] = useState<RwgpsActivity[]>([]);
  const [fetched_at, set_fetched_at] = useState<string | null>(null);
  const [error, set_error] = useState<string | null>(null);

  async function fetch_data() {
    try {
      const res = await fetch('/api/ridewithgps/data');
      const data = await res.json();
      if (!res.ok) {
        set_error(data.error || 'Failed to load Ride with GPS activities');
        return;
      }
      set_activities(data.activities || []);
      set_fetched_at(data.fetched_at || null);
      set_error(null);
    } catch {
      set_error('Failed to load Ride with GPS activities');
    }
  }

  useEffect(() => {
    document.title = '8i11 | Ride with GPS';
    async function load() {
      await fetch_data();
      set_loading(false);
    }
    load();
  }, []);

  async function handle_refresh() {
    set_refreshing(true);
    await fetch_data();
    set_refreshing(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] text-white">
      <NavTabs />
      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-cyan-400">Ride with GPS</h1>
          <button
            onClick={handle_refresh}
            disabled={refreshing}
            className="px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded hover:bg-white/10 disabled:opacity-50 transition"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-2 bg-red-500/20 border border-red-500/40 rounded text-red-300 text-sm flex items-center justify-between gap-4">
            <span>{error}</span>
            <button
              onClick={handle_refresh}
              className="shrink-0 px-3 py-1 text-xs bg-white/10 border border-white/20 rounded hover:bg-white/20 transition"
            >
              Retry
            </button>
          </div>
        )}

        {loading && (
          <div className="text-gray-400 text-center py-16">Loading…</div>
        )}

        {!loading && !error && (
          <div className="space-y-4">
            {fetched_at && (
              <p className="text-xs text-gray-500 text-right">
                Last updated: {new Date(fetched_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            )}

            <div>
              <h2 className="text-lg font-semibold text-cyan-400 mb-3">
                Recent Activities
                <span className="text-sm text-gray-500 font-normal ml-2">({activities.length})</span>
              </h2>

              {activities.length === 0 ? (
                <p className="text-gray-500 text-sm">No activities found.</p>
              ) : (
                <div className="space-y-2">
                  {activities.map((a, i) => {
                    const dist = meters_to_miles(a.distance);
                    const elev = meters_to_feet(a.total_elevation_gain);
                    return (
                      <div
                        key={a.id ?? i}
                        className="border border-white/10 rounded-lg px-4 py-3 flex items-start gap-3"
                      >
                        <span className="text-xl flex-shrink-0 mt-0.5">{activity_icon(a.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold truncate">{a.name}</span>
                            <span className="text-xs text-gray-500">{format_date(a.departed_at)}</span>
                            {a.url && (
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-cyan-400 hover:text-cyan-300 ml-auto flex-shrink-0"
                              >
                                View ↗
                              </a>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-sm text-gray-300">
                            <span className="text-gray-500">{a.type}</span>
                            {dist && <span>{dist}</span>}
                            {a.moving_time > 0 && <span>{format_duration(a.moving_time)}</span>}
                            {elev && <span>↑ {elev}</span>}
                            {a.average_heartrate != null && (
                              <span className="text-red-400">♥ {Math.round(a.average_heartrate)} bpm</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
