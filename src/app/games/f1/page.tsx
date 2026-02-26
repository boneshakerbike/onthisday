'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import SeasonGrid from '@/components/f1/season_grid';
import WeekendView from '@/components/f1/weekend_view';
import Leaderboard from '@/components/f1/leaderboard';
import RosterManager from '@/components/f1/roster_manager';
import PlayerPicker from '@/components/f1/player_picker';
import type { F1RaceSchedule, F1Driver, F1DriverResult, SessionType } from '@/lib/f1/types';

interface SessionInfo {
  session_type: SessionType;
  state: string;
  prediction: { p1: string; p2: string; p3: string; fastest_lap: string | null; is_locked?: boolean } | null;
  score: { perfect_match: number; podium_lock: number; almost: number; fastest_lap: number; total: number } | null;
}

interface RevealData {
  results: F1DriverResult[];
  fastest_lap_driver_id: string | null;
  prediction: { p1: string; p2: string; p3: string; fastest_lap: string | null } | null;
  score: { perfect_match: number; podium_lock: number; almost: number; fastest_lap: number; total: number } | null;
}

interface LeaderboardEntry {
  player_name: string;
  total_score: number;
  sessions_played: number;
}

export default function F1Page() {
  const current_year = new Date().getFullYear();
  const { data: auth_session } = useSession();
  const is_admin = !!auth_session?.user && (auth_session.user as { id?: string }).id !== 'guest';
  const [season, set_season] = useState(current_year);
  const [races, set_races] = useState<F1RaceSchedule[]>([]);
  const [drivers, set_drivers] = useState<F1Driver[]>([]);
  const [selected_round, set_selected_round] = useState<number | null>(null);
  const [sessions, set_sessions] = useState<SessionInfo[]>([]);
  const [standings, set_standings] = useState<LeaderboardEntry[]>([]);
  const [revealed_data, set_revealed_data] = useState<Record<string, RevealData>>({});
  const [active_form, set_active_form] = useState<string | null>(null);
  const [submitting, set_submitting] = useState(false);
  const [revealing, set_revealing] = useState<string | null>(null);
  const [player_name, set_player_name] = useState('');
  const [player_id, set_player_id] = useState('');
  const [name_resolving, set_name_resolving] = useState(true);
  const [show_name_prompt, set_show_name_prompt] = useState(false);
  const [loading, set_loading] = useState(true);
  const [error, set_error] = useState<string | null>(null);
  const [roster, set_roster] = useState<string[]>([]);
  const [roster_loaded, set_roster_loaded] = useState(false);
  const [active_round, set_active_round] = useState<number | undefined>(undefined);
  const [completed_rounds, set_completed_rounds] = useState<number[]>([]);
  const [show_roster, set_show_roster] = useState(false);
  const [setup_banner_dismissed, set_setup_banner_dismissed] = useState(false);
  const initialized_from_url = useRef(false);

  // Read season/round from URL params on mount (prevents "bounces to 2026" on refresh)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url_season = parseInt(params.get('season') || '');
    const url_round = parseInt(params.get('round') || '');
    if (url_season && !isNaN(url_season)) set_season(url_season);
    if (url_round && !isNaN(url_round)) set_selected_round(url_round);
    initialized_from_url.current = true;
  }, []);

  // Update URL when season/round changes
  useEffect(() => {
    if (!initialized_from_url.current) return;
    const params = new URLSearchParams();
    params.set('season', String(season));
    if (selected_round) params.set('round', String(selected_round));
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, [season, selected_round]);

  // Clear stale UI whenever the selected round changes
  useEffect(() => {
    set_revealed_data({});
    set_active_form(null);
    set_sessions([]);
  }, [selected_round]);

  // Load player identity from localStorage; if no claimed ID, picker will show after roster loads
  useEffect(() => {
    const id = localStorage.getItem('f1_player_id');
    if (!id) {
      set_name_resolving(false);
      return;
    }
    set_player_id(id);
    fetch(`/api/f1/player?id=${encodeURIComponent(id)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.display_name) {
          set_player_name(data.display_name);
          localStorage.setItem('f1_player_name', data.display_name);
        }
        // If server has no record for this id, player_name stays empty → picker shows
        set_name_resolving(false);
      })
      .catch(() => {
        const local_name = localStorage.getItem('f1_player_name');
        if (local_name) set_player_name(local_name);
        set_name_resolving(false);
      });
  }, []);

  // Once roster is loaded and identity is resolved, show picker for guests with an unclaimed roster
  useEffect(() => {
    if (!roster_loaded || name_resolving || is_admin) return;
    const has_id = !!localStorage.getItem('f1_player_id');
    if ((!has_id || !player_name) && roster.length > 0) {
      set_show_name_prompt(true);
    }
  }, [roster_loaded, name_resolving, is_admin, player_name, roster]);

  // Claim a roster name as this device's identity
  const claim_player = (name: string) => {
    localStorage.setItem('f1_player_id', name);
    localStorage.setItem('f1_player_name', name);
    set_player_id(name);
    set_player_name(name);
    set_show_name_prompt(false);
    fetch('/api/f1/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: name, display_name: name }),
    }).catch(() => {});
  };

  // Reset device association; admin gets inline picker, guest gets modal
  const reset_player = () => {
    localStorage.removeItem('f1_player_id');
    localStorage.removeItem('f1_player_name');
    set_player_id('');
    set_player_name('');
    if (!is_admin) set_show_name_prompt(true);
  };

  // Fetch season progress + roster
  const refresh_progress = useCallback(() => {
    fetch(`/api/f1/season_progress?season=${season}`)
      .then(res => res.json())
      .then(data => {
        set_roster(data.roster || []);
        set_active_round(data.roster?.length > 0 ? data.active_round : undefined);
        set_completed_rounds(data.roster?.length > 0 ? (data.completed_rounds || []) : []);
        set_roster_loaded(true);
      })
      .catch(() => { set_roster_loaded(true); });
  }, [season]);

  useEffect(() => { refresh_progress(); }, [refresh_progress]);

  // Fetch schedule
  useEffect(() => {
    set_loading(true);
    set_error(null);
    fetch(`/api/f1/schedule?season=${season}`)
      .then(res => res.json())
      .then(data => {
        set_races(data.races || []);
        set_loading(false);
      })
      .catch(err => {
        set_error(err.message);
        set_loading(false);
      });
  }, [season]);

  // Fetch drivers
  useEffect(() => {
    fetch(`/api/f1/drivers?season=${season}`)
      .then(res => res.json())
      .then(data => set_drivers(data.drivers || []))
      .catch(() => {}); // non-critical, form will show empty
  }, [season]);

  // Fetch leaderboard
  const refresh_leaderboard = useCallback(() => {
    fetch(`/api/f1/leaderboard?season=${season}`)
      .then(res => res.json())
      .then(data => set_standings(data.standings || []))
      .catch(() => {});
  }, [season]);

  useEffect(() => { refresh_leaderboard(); }, [refresh_leaderboard]);

  // Fetch player state for selected round
  const refresh_state = useCallback(() => {
    if (!selected_round || !player_name) return;
    fetch(`/api/f1/state?season=${season}&round=${selected_round}&player=${encodeURIComponent(player_name)}`)
      .then(res => res.json())
      .then(data => set_sessions(data.sessions || []))
      .catch(() => {});
  }, [season, selected_round, player_name]);

  useEffect(() => { refresh_state(); }, [refresh_state]);

  // Poll group state every 5s when viewing a weekend (so other players' picks appear live)
  useEffect(() => {
    if (!selected_round || !player_name) return;
    const interval = setInterval(refresh_state, 5000);
    return () => clearInterval(interval);
  }, [selected_round, player_name, refresh_state]);

  // Poll leaderboard + season progress every 10s on calendar view
  useEffect(() => {
    if (selected_round) return;
    const interval = setInterval(() => {
      refresh_leaderboard();
      refresh_progress();
    }, 10000);
    return () => clearInterval(interval);
  }, [selected_round, refresh_leaderboard, refresh_progress]);

  // Load cached revealed data for already-revealed sessions
  useEffect(() => {
    if (!sessions.length) return;

    const revealed_sessions = sessions.filter(s => s.state === 'revealed');
    for (const s of revealed_sessions) {
      if (revealed_data[s.session_type]) continue;

      fetch(`/api/f1/results?season=${season}&round=${selected_round}&session_type=${s.session_type}`)
        .then(res => {
          if (!res.ok) return null;
          return res.json();
        })
        .then(data => {
          if (!data) return;
          set_revealed_data(prev => ({
            ...prev,
            [s.session_type]: {
              results: data.results,
              fastest_lap_driver_id: data.fastest_lap_driver_id,
              prediction: s.prediction,
              score: s.score,
            },
          }));
        })
        .catch(() => {});
    }
  }, [sessions, season, selected_round, revealed_data]);

  // Submit prediction
  const handle_predict = async (
    session_type: SessionType, p1: string, p2: string, p3: string, fastest_lap: string | null
  ) => {
    set_submitting(true);
    try {
      const res = await fetch('/api/f1/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, round: selected_round, session_type, player_name, p1, p2, p3, fastest_lap }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to submit');
        return;
      }
      set_active_form(null);
      refresh_state();
    } catch {
      alert('Failed to submit prediction');
    } finally {
      set_submitting(false);
    }
  };

  // Lock prediction (picks must already be saved via Save Picks)
  const handle_lock = async (session_type: SessionType) => {
    set_submitting(true);
    try {
      const res = await fetch('/api/f1/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, round: selected_round, session_type, player_name }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to lock prediction');
        return;
      }
      refresh_state();
    } catch {
      alert('Failed to lock prediction');
    } finally {
      set_submitting(false);
    }
  };

  // Reveal results
  const handle_reveal = async (session_type: SessionType) => {
    set_revealing(session_type);
    try {
      const res = await fetch('/api/f1/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, round: selected_round, session_type, player_name }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to reveal');
        return;
      }
      set_revealed_data(prev => ({
        ...prev,
        [session_type]: data,
      }));
      refresh_state();
      refresh_leaderboard();
      refresh_progress();
    } catch {
      alert('Failed to reveal results');
    } finally {
      set_revealing(null);
    }
  };

  const selected_race = races.find(r => r.round === selected_round);

  return (
    <>
      <style jsx>{`
        .f1-page {
          max-width: 720px;
          margin: 0 auto;
          padding: 1.5rem 1rem;
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #15151e;
          color: #e0e0e0;
        }
        .f1-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }
        .f1-title {
          color: #ffffff;
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
        }
        .f1-title-year {
          color: #e10600;
        }
        .f1-badge {
          display: inline-block;
          background: #e10600;
          color: #ffffff;
          font-weight: 900;
          font-style: italic;
          padding: 0.1rem 0.45rem;
          border-radius: 4px;
          font-size: 1.1rem;
          letter-spacing: -0.03em;
          margin-right: 0.3rem;
          vertical-align: baseline;
        }
        .f1-subtitle {
          color: #888;
          font-size: 0.85rem;
        }
        .player-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          padding: 0.5rem 0.75rem;
          background: rgba(255,255,255,0.03);
          border-radius: 8px;
        }
        .player-name {
          color: #e0e0e0;
          font-size: 0.85rem;
        }
        .change-name {
          background: none;
          border: none;
          color: #e10600;
          cursor: pointer;
          font-size: 0.75rem;
        }
        .other-years {
          text-align: center;
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .other-years-label {
          color: #555;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }
        .year-btn {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          color: #666;
          border-radius: 6px;
          padding: 0.3rem 0.75rem;
          cursor: pointer;
          font-size: 0.8rem;
          margin: 0 0.25rem;
        }
        .year-btn:hover {
          color: #e10600;
          border-color: rgba(225,6,0,0.3);
        }
      `}</style>

      <div style={{ background: '#15151e', minHeight: '100vh' }}>
      <div className="f1-page">
        <div className="f1-header">
          <div className="f1-title">
            <span className="f1-badge">F1</span> <span className="f1-title-year">{season}</span> Predictors&apos; Championship
          </div>
          <div className="f1-subtitle">Predict the podium. Avoid spoilers. Settle the score.</div>
        </div>

        {/* Guest blocking picker — roster exists, guest hasn't claimed */}
        {show_name_prompt && !is_admin && (
          <PlayerPicker roster={roster} on_claim={claim_player} />
        )}

        {/* Admin: empty-season setup banner */}
        {is_admin && roster_loaded && roster.length === 0 && !setup_banner_dismissed && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
            background: 'rgba(225,6,0,0.08)', border: '1px solid rgba(225,6,0,0.25)',
            borderRadius: '8px', padding: '0.6rem 0.75rem', marginBottom: '1rem', fontSize: '0.85rem',
          }}>
            <span style={{ color: '#ccc' }}><strong>{season}</strong> season not set up — add players to get started.</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => set_show_roster(true)}
                style={{ background: '#e10600', border: 'none', color: '#fff', borderRadius: '5px', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
              >
                Open Roster Manager
              </button>
              <button
                onClick={() => set_setup_banner_dismissed(true)}
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Admin: inline name picker — roster exists but admin hasn't claimed */}
        {is_admin && roster_loaded && roster.length > 0 && !player_name && (
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px', padding: '0.6rem 0.75rem', marginBottom: '1rem',
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem',
          }}>
            <span style={{ color: '#888', fontSize: '0.8rem' }}>Playing as:</span>
            {roster.map(name => (
              <button
                key={name}
                onClick={() => claim_player(name)}
                style={{
                  background: 'rgba(225,6,0,0.1)', border: '1px solid rgba(225,6,0,0.3)',
                  color: '#e0e0e0', borderRadius: '5px', padding: '0.25rem 0.6rem',
                  fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600,
                }}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {/* Guest: empty roster message with season navigation */}
        {!is_admin && roster_loaded && roster.length === 0 && !player_name && (
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px', padding: '1rem', marginBottom: '1rem', textAlign: 'center',
          }}>
            <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              No players on the roster yet.
            </div>
            <div style={{ color: '#666', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Browse previous seasons:</div>
            <button className="year-btn" onClick={() => { set_season(s => s - 1); set_selected_round(null); }}>
              &larr; {season - 1}
            </button>
          </div>
        )}

        {/* Player bar */}
        {(player_name || is_admin) && (
          <div className="player-bar">
            <span className="player-name">
              {player_name ? <>Playing as: <strong>{player_name}</strong></> : <span style={{ color: '#555' }}>Not playing</span>}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {player_name && (
                <button className="change-name" onClick={reset_player}>
                  Not {player_name}?
                </button>
              )}
              {is_admin && (
                <button
                  onClick={() => set_show_roster(prev => !prev)}
                  style={{
                    background: show_roster ? 'rgba(225,6,0,0.15)' : 'none',
                    border: 'none',
                    color: show_roster ? '#e10600' : '#666',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    padding: '0.2rem',
                    lineHeight: 1,
                    borderRadius: '4px',
                  }}
                  title="Manage roster"
                >
                  &#9881;
                </button>
              )}
            </div>
          </div>
        )}

        {/* Roster manager (toggled by gear icon) */}
        {show_roster && is_admin && (
          <RosterManager
            season={season}
            roster={roster}
            on_roster_change={(new_roster) => {
              set_roster(new_roster);
              refresh_progress();
            }}
            on_season_reset={() => {
              refresh_leaderboard();
              refresh_progress();
              set_sessions([]);
              set_revealed_data({});
            }}
          />
        )}

        {/* Leaderboard — loads independently, not gated on schedule fetch */}
        {!selected_round && (
          <Leaderboard standings={standings} season={season} />
        )}

        {/* Loading / Error */}
        {loading && !selected_round && (
          <div style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
            Loading {season} schedule...
          </div>
        )}
        {error && (
          <div style={{ textAlign: 'center', color: '#ff4466', padding: '2rem' }}>
            {error}
          </div>
        )}

        {/* Main content */}
        {!loading && !error && (
          <>
            {selected_round && selected_race ? (
              <WeekendView
                race={selected_race}
                sessions={sessions}
                drivers={drivers}
                revealed_data={revealed_data}
                active_form={active_form}
                on_predict_click={(st) => set_active_form(st)}
                on_predict_cancel={() => set_active_form(null)}
                on_predict_submit={handle_predict}
                on_lock={handle_lock}
                on_reveal={handle_reveal}
                submitting={submitting}
                revealing={revealing}
                on_back={() => {
                  set_selected_round(null);
                  set_sessions([]);
                  set_revealed_data({});
                  set_active_form(null);
                }}
              />
            ) : (
              <>
                {races.length > 0 ? (
                  <SeasonGrid
                    races={races}
                    season={season}
                    active_round={active_round}
                    completed_rounds={completed_rounds}
                    on_select_round={(round) => {
                      set_selected_round(round);
                      set_revealed_data({});
                      set_active_form(null);
                    }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                    No races found for {season}. Try a different year.
                  </div>
                )}
                {/* Other years - de-emphasized at bottom */}
                <div className="other-years">
                  <div className="other-years-label">Other Seasons</div>
                  <button className="year-btn" onClick={() => { set_season(s => s - 1); set_selected_round(null); }}>
                    &larr; {season - 1}
                  </button>
                  <button className="year-btn" onClick={() => { set_season(s => s + 1); set_selected_round(null); }}>
                    {season + 1} &rarr;
                  </button>
                </div>
              </>
            )}
          </>
        )}
        <div style={{ textAlign: 'center', marginTop: '3rem', paddingBottom: '1rem' }}>
          <a href="/" style={{ color: '#333', fontSize: '0.7rem', textDecoration: 'none' }}>8i11</a>
        </div>
      </div>
      </div>
    </>
  );
}
