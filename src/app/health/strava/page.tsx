/**
 * Strava Dashboard - Athlete profile, stats, and recent activities
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import NavTabs from '@/components/nav_tabs';

const SPORT_ICONS: Record<string, string> = {
  Run: '🏃', VirtualRun: '🏃', TrailRun: '🏃',
  Ride: '🚴', VirtualRide: '🚴', EBikeRide: '⚡', MountainBikeRide: '🚵', GravelRide: '🚵',
  Swim: '🏊',
  Walk: '🚶', Hike: '🥾',
  AlpineSki: '⛷️', NordicSki: '🎿', BackcountrySki: '⛷️',
  Snowboard: '🏂', IceSkate: '⛸️',
  WeightTraining: '🏋️', Workout: '💪', Crossfit: '💪',
  Yoga: '🧘', Pilates: '🧘',
  RockClimbing: '🧗',
  Kayaking: '🛶', Rowing: '🚣', Canoeing: '🛶', Surfing: '🏄',
  Soccer: '⚽', Tennis: '🎾', Golf: '⛳', Basketball: '🏀',
  Skateboard: '🛹',
};

function sport_icon(sport_type: string | undefined, type: string | undefined): string {
  const key = sport_type || type || '';
  return SPORT_ICONS[key] || '🏅';
}

function format_duration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function meters_to_miles(m: number | null | undefined): string {
  if (m == null || m === 0) return '—';
  return (m / 1609.344).toFixed(1) + ' mi';
}

function meters_to_feet(m: number | null | undefined): string {
  if (m == null || m === 0) return '—';
  return Math.round(m * 3.28084).toLocaleString() + ' ft';
}

function km_to_miles(km: number | null | undefined): string {
  if (km == null || km === 0) return '—';
  return ((km * 1000) / 1609.344).toFixed(1) + ' mi';
}

function time_ago(iso: string | null): string {
  if (!iso) return '';
  const diff_ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff_ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function format_activity_date(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return '—'; }
}

function format_activity_datetime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch { return '—'; }
}

// Returns 0 for today, 1 for yesterday, etc., based on local date.
function days_ago_local(start_date_local: string | undefined): number | null {
  if (!start_date_local) return null;
  const act = new Date(start_date_local);
  if (isNaN(act.getTime())) return null;
  const now = new Date();
  const a = new Date(act.getFullYear(), act.getMonth(), act.getDate()).getTime();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((t - a) / 86_400_000);
}

function mps_to_mph(mps: number | null | undefined): string {
  if (mps == null || mps === 0) return '—';
  return (mps * 2.23694).toFixed(1) + ' mph';
}

interface SportTotals {
  count: number;
  distance: number;
  moving_time: number;
  elevation_gain: number;
}

interface StatGroup {
  recent: SportTotals;
  ytd: SportTotals;
  all: SportTotals;
}

function stat_group(stats: Record<string, unknown>, prefix: string): StatGroup {
  function totals(key: string): SportTotals {
    const t = stats[key] as Record<string, unknown> | null | undefined;
    return {
      count: (t?.count as number) ?? 0,
      distance: (t?.distance as number) ?? 0,
      moving_time: (t?.moving_time as number) ?? 0,
      elevation_gain: (t?.elevation_gain as number) ?? 0,
    };
  }
  return {
    recent: totals(`recent_${prefix}_totals`),
    ytd: totals(`ytd_${prefix}_totals`),
    all: totals(`all_${prefix}_totals`),
  };
}

function has_activity(g: StatGroup): boolean {
  return g.all.count > 0;
}

interface StatCardProps {
  label: string;
  emoji: string;
  group: StatGroup;
}

function StatCard({ label, emoji, group }: StatCardProps) {
  const cols = [
    { title: 'Recent', data: group.recent },
    { title: 'YTD', data: group.ytd },
    { title: 'All Time', data: group.all },
  ];

  return (
    <div className="border border-white/10 rounded-lg p-4">
      <h3 className="text-cyan-400 font-semibold mb-3">{emoji} {label}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 text-xs border-b border-white/10">
            <th className="text-left pb-1 font-normal"></th>
            {cols.map(c => (
              <th key={c.title} className="text-right pb-1 font-normal">{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody className="text-gray-200">
          <tr>
            <td className="py-1 text-gray-400 text-xs">Distance</td>
            {cols.map(c => (
              <td key={c.title} className="py-1 text-right">{meters_to_miles(c.data.distance)}</td>
            ))}
          </tr>
          <tr>
            <td className="py-1 text-gray-400 text-xs">Time</td>
            {cols.map(c => (
              <td key={c.title} className="py-1 text-right">{format_duration(c.data.moving_time)}</td>
            ))}
          </tr>
          <tr>
            <td className="py-1 text-gray-400 text-xs">Elevation</td>
            {cols.map(c => (
              <td key={c.title} className="py-1 text-right">{meters_to_feet(c.data.elevation_gain)}</td>
            ))}
          </tr>
          <tr>
            <td className="py-1 text-gray-400 text-xs">Activities</td>
            {cols.map(c => (
              <td key={c.title} className="py-1 text-right">{c.data.count || '—'}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Inner component (uses useSearchParams) ──────────────────

function StravaInner() {
  const search_params = useSearchParams();
  const [connected, set_connected] = useState<boolean | null>(null);
  const [loading, set_loading] = useState(true);
  const [refreshing, set_refreshing] = useState(false);
  const [athlete, set_athlete] = useState<Record<string, unknown> | null>(null);
  const [stats, set_stats] = useState<Record<string, unknown> | null>(null);
  const [activities, set_activities] = useState<Record<string, unknown>[]>([]);
  const [cached_at, set_cached_at] = useState<string | null>(null);
  const [error, set_error] = useState<string | null>(null);
  const [needs_reconnect, set_needs_reconnect] = useState(false);
  const [warning, set_warning] = useState<string | null>(null);
  const [toast, set_toast] = useState<string | null>(null);
  const [expanded_ids, set_expanded_ids] = useState<Set<number>>(new Set());

  function toggle_expanded(id: number) {
    set_expanded_ids(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function show_toast(msg: string) {
    set_toast(msg);
    setTimeout(() => set_toast(null), 3500);
  }

  async function fetch_data(force = false) {
    try {
      const url = force ? '/api/strava/data?force=true' : '/api/strava/data';
      const res = await fetch(url);
      const data = await res.json();

      if (data.connected === false) {
        set_connected(false);
        set_needs_reconnect(res.status === 401);
        if (res.status === 401) set_error(data.error || 'Strava session expired');
        return;
      }
      if (!res.ok) {
        set_error(data.error || 'Failed to load Strava data');
        set_connected(true);
        return;
      }

      set_connected(true);
      set_needs_reconnect(false);
      set_athlete(data.athlete);
      set_stats(data.stats);
      set_activities(data.activities || []);
      set_cached_at(data.cached_at || null);
      set_error(null);
      set_warning(data.partial_error || null);
    } catch {
      set_error('Failed to load Strava data');
    }
  }

  useEffect(() => {
    document.title = '8i11 | Strava';

    const conn = search_params.get('connected');
    const err = search_params.get('error');

    if (conn === 'true') show_toast('Strava connected!');
    if (err) set_error(`OAuth error: ${err}`);

    fetch_data().finally(() => set_loading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handle_refresh() {
    set_refreshing(true);
    try {
      const sync_res = await fetch('/api/strava/sync', { method: 'POST' });
      const sync_data = await sync_res.json().catch(() => null);
      await fetch_data(true);
      if (sync_data?.partial_error) {
        set_warning(sync_data.partial_error);
      } else {
        show_toast('Refreshed');
      }
    } catch {
      set_error('Refresh failed');
    } finally {
      set_refreshing(false);
    }
  }

  async function handle_disconnect() {
    if (!confirm('Disconnect Strava? This will remove all cached data.')) return;
    try {
      await fetch('/api/strava/disconnect', { method: 'DELETE' });
      set_connected(false);
      set_athlete(null);
      set_stats(null);
      set_activities([]);
      set_cached_at(null);
      show_toast('Disconnected from Strava');
    } catch {
      set_error('Disconnect failed');
    }
  }

  const gear_bikes = [...((athlete?.bikes as Record<string, unknown>[] | null) || [])]
    .sort((a, b) => ((b.distance as number) || 0) - ((a.distance as number) || 0));

  const swim_group = stats ? stat_group(stats, 'swim') : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] text-white">
      <NavTabs />
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-cyan-400">Strava</h1>
          {connected && !loading && (
            <div className="flex gap-2">
              <button
                onClick={handle_refresh}
                disabled={refreshing}
                className="px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded hover:bg-white/10 disabled:opacity-50 transition"
              >
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
              <button
                onClick={handle_disconnect}
                className="px-3 py-1.5 text-sm bg-white/5 border border-red-500/30 text-red-400 rounded hover:bg-red-500/10 transition"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="mb-4 px-4 py-2 bg-green-500/20 border border-green-500/40 rounded text-green-300 text-sm">
            {toast}
          </div>
        )}

        {/* Error */}
        {error && connected !== false && (
          <div className="mb-4 px-4 py-2 bg-red-500/20 border border-red-500/40 rounded text-red-300 text-sm flex items-center justify-between gap-4">
            <span>{error}</span>
            <button
              onClick={() => fetch_data()}
              className="shrink-0 px-3 py-1 text-xs bg-white/10 border border-white/20 rounded hover:bg-white/20 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Warning: partial failure, showing last saved data */}
        {warning && (
          <div className="mb-4 px-4 py-2 bg-yellow-500/20 border border-yellow-500/40 rounded text-yellow-200 text-sm flex items-center justify-between gap-4">
            <span>{warning}</span>
            <button
              onClick={handle_refresh}
              disabled={refreshing}
              className="shrink-0 px-3 py-1 text-xs bg-white/10 border border-white/20 rounded hover:bg-white/20 disabled:opacity-50 transition"
            >
              {refreshing ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-gray-400 text-center py-16">Loading…</div>
        )}

        {/* Not connected */}
        {!loading && connected === false && (
          <div className="border border-white/10 rounded-lg p-8 text-center">
            <div className="text-4xl mb-4">🚴</div>
            <h2 className="text-lg font-semibold mb-2">
              {needs_reconnect ? 'Reconnect Strava' : 'Connect Strava'}
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              {needs_reconnect
                ? (error || 'Your Strava connection expired. Please reconnect.')
                : 'See your athlete profile, training stats, and recent activities.'}
            </p>
            <a
              href="/api/strava/authorize"
              className="inline-block px-6 py-2.5 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded transition"
            >
              {needs_reconnect ? 'Reconnect with Strava' : 'Connect with Strava'}
            </a>
          </div>
        )}

        {/* Connected: data */}
        {!loading && connected && athlete && (
          <div className="space-y-6">

            {/* Cache freshness */}
            {cached_at && (
              <p className="text-xs text-gray-500 text-right">
                Last updated: {time_ago(cached_at)}
              </p>
            )}

            {/* Athlete Profile Card */}
            <div className="border border-white/10 rounded-lg p-5">
              <div className="flex gap-4 text-sm text-gray-400">
                {athlete.follower_count != null && (
                  <span>{(athlete.follower_count as number).toLocaleString()} followers</span>
                )}
                {athlete.friend_count != null && (
                  <span>{(athlete.friend_count as number).toLocaleString()} following</span>
                )}
              </div>

              {gear_bikes.length > 0 && (
                <div className="mt-3 space-y-1">
                  {gear_bikes.map((b, i) => (
                    <div key={i} className="text-xs text-gray-400">
                      🚴 {(b.name as string) || 'Bike'}: {km_to_miles((b.distance as number) / 1000)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {swim_group && has_activity(swim_group) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatCard label="Swimming" emoji="🏊" group={swim_group} />
              </div>
            )}

            {/* Recent Activities */}
            <div>
              <h2 className="text-lg font-semibold text-cyan-400 mb-3">
                Recent Activities
                <span className="text-sm text-gray-500 font-normal ml-2">
                  ({activities.length})
                </span>
              </h2>

              {activities.length === 0 ? (
                <p className="text-gray-500 text-sm">No activities found.</p>
              ) : (
                <div className="space-y-2">
                  {activities.map((act, i) => {
                    const id = act.id as number;
                    const name = act.name as string | undefined;
                    const sport = act.sport_type as string | undefined;
                    const type = act.type as string | undefined;
                    const distance = act.distance as number | undefined;
                    const moving_time = act.moving_time as number | undefined;
                    const elapsed_time = act.elapsed_time as number | undefined;
                    const elevation = act.total_elevation_gain as number | undefined;
                    const start_date = act.start_date_local as string | undefined;
                    const avg_hr = act.average_heartrate as number | undefined;
                    const max_hr = act.max_heartrate as number | undefined;
                    const avg_watts = act.average_watts as number | undefined;
                    const max_watts = act.max_watts as number | undefined;
                    const weighted_avg_watts = act.weighted_average_watts as number | undefined;
                    const kilojoules = act.kilojoules as number | undefined;
                    const avg_cadence = act.average_cadence as number | undefined;
                    const avg_speed = act.average_speed as number | undefined;
                    const max_speed = act.max_speed as number | undefined;
                    const elev_high = act.elev_high as number | undefined;
                    const elev_low = act.elev_low as number | undefined;
                    const suffer_score = act.suffer_score as number | undefined;
                    const kudos_count = act.kudos_count as number | undefined;
                    const comment_count = act.comment_count as number | undefined;
                    const achievement_count = act.achievement_count as number | undefined;
                    const pr_count = act.pr_count as number | undefined;
                    const athlete_count = act.athlete_count as number | undefined;
                    const location_city = act.location_city as string | undefined;
                    const location_state = act.location_state as string | undefined;
                    const location_country = act.location_country as string | undefined;

                    const day_offset = days_ago_local(start_date);
                    const expandable = day_offset === 0 || day_offset === 1;
                    const is_expanded = expandable && expanded_ids.has(id);
                    const day_label = day_offset === 0 ? 'Today' : day_offset === 1 ? 'Yesterday' : null;
                    const location = [location_city, location_state, location_country].filter(Boolean).join(', ');

                    return (
                      <div
                        key={id || i}
                        className="border border-white/10 rounded-lg px-4 py-3 hover:bg-white/5 transition"
                      >
                        <div
                          className={`flex items-start gap-3 ${expandable ? 'cursor-pointer' : ''}`}
                          onClick={expandable && id ? () => toggle_expanded(id) : undefined}
                        >
                          <span className="text-xl flex-shrink-0 mt-0.5">{sport_icon(sport, type)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold truncate">{name || sport || 'Activity'}</span>
                              {day_label ? (
                                <span className="text-xs text-cyan-400">{day_label}</span>
                              ) : (
                                <span className="text-xs text-gray-500">{format_activity_date(start_date)}</span>
                              )}
                              {expandable && (
                                <span className="text-xs text-gray-500">{is_expanded ? '▾' : '▸'}</span>
                              )}
                              {id && (
                                <a
                                  href={`https://www.strava.com/activities/${id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-orange-400 hover:text-orange-300 ml-auto flex-shrink-0"
                                >
                                  View ↗
                                </a>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-sm text-gray-300">
                              {distance != null && distance > 0 && (
                                <span>{meters_to_miles(distance)}</span>
                              )}
                              {moving_time != null && (
                                <span>{format_duration(moving_time)}</span>
                              )}
                              {elevation != null && elevation > 0 && (
                                <span>↑ {meters_to_feet(elevation)}</span>
                              )}
                              {avg_hr != null && (
                                <span className="text-red-400">♥ {Math.round(avg_hr)} bpm</span>
                              )}
                              {avg_watts != null && (
                                <span className="text-yellow-400">⚡ {Math.round(avg_watts)}w</span>
                              )}
                              {avg_cadence != null && (
                                <span className="text-gray-400">{Math.round(avg_cadence)} rpm</span>
                              )}
                              {suffer_score != null && suffer_score > 0 && (
                                <span className="text-purple-400">💜 {suffer_score}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {is_expanded && (
                          <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                            {start_date && (
                              <div>
                                <div className="text-gray-500">Started</div>
                                <div className="text-gray-200">{format_activity_datetime(start_date)}</div>
                              </div>
                            )}
                            {location && (
                              <div>
                                <div className="text-gray-500">Location</div>
                                <div className="text-gray-200">{location}</div>
                              </div>
                            )}
                            {elapsed_time != null && (
                              <div>
                                <div className="text-gray-500">Elapsed</div>
                                <div className="text-gray-200">{format_duration(elapsed_time)}</div>
                              </div>
                            )}
                            {avg_speed != null && avg_speed > 0 && (
                              <div>
                                <div className="text-gray-500">Avg Speed</div>
                                <div className="text-gray-200">{mps_to_mph(avg_speed)}</div>
                              </div>
                            )}
                            {max_speed != null && max_speed > 0 && (
                              <div>
                                <div className="text-gray-500">Max Speed</div>
                                <div className="text-gray-200">{mps_to_mph(max_speed)}</div>
                              </div>
                            )}
                            {max_hr != null && (
                              <div>
                                <div className="text-gray-500">Max HR</div>
                                <div className="text-red-400">♥ {Math.round(max_hr)} bpm</div>
                              </div>
                            )}
                            {weighted_avg_watts != null && (
                              <div>
                                <div className="text-gray-500">Norm. Power</div>
                                <div className="text-yellow-400">{Math.round(weighted_avg_watts)}w</div>
                              </div>
                            )}
                            {max_watts != null && (
                              <div>
                                <div className="text-gray-500">Max Power</div>
                                <div className="text-yellow-400">{Math.round(max_watts)}w</div>
                              </div>
                            )}
                            {kilojoules != null && kilojoules > 0 && (
                              <div>
                                <div className="text-gray-500">Energy</div>
                                <div className="text-gray-200">{Math.round(kilojoules)} kJ</div>
                              </div>
                            )}
                            {elev_high != null && (
                              <div>
                                <div className="text-gray-500">Elev High</div>
                                <div className="text-gray-200">{meters_to_feet(elev_high)}</div>
                              </div>
                            )}
                            {elev_low != null && (
                              <div>
                                <div className="text-gray-500">Elev Low</div>
                                <div className="text-gray-200">{meters_to_feet(elev_low)}</div>
                              </div>
                            )}
                            {kudos_count != null && (
                              <div>
                                <div className="text-gray-500">Kudos</div>
                                <div className="text-gray-200">{kudos_count}</div>
                              </div>
                            )}
                            {comment_count != null && comment_count > 0 && (
                              <div>
                                <div className="text-gray-500">Comments</div>
                                <div className="text-gray-200">{comment_count}</div>
                              </div>
                            )}
                            {achievement_count != null && achievement_count > 0 && (
                              <div>
                                <div className="text-gray-500">Achievements</div>
                                <div className="text-gray-200">{achievement_count}</div>
                              </div>
                            )}
                            {pr_count != null && pr_count > 0 && (
                              <div>
                                <div className="text-gray-500">PRs</div>
                                <div className="text-gray-200">{pr_count}</div>
                              </div>
                            )}
                            {athlete_count != null && athlete_count > 1 && (
                              <div>
                                <div className="text-gray-500">Athletes</div>
                                <div className="text-gray-200">{athlete_count}</div>
                              </div>
                            )}
                          </div>
                        )}
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

// ─── Page wrapper with Suspense ──────────────────────────────

export default function StravaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] text-white flex items-center justify-center">
        <div className="text-gray-400">Loading…</div>
      </div>
    }>
      <StravaInner />
    </Suspense>
  );
}
