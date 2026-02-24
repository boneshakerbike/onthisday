'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import NavTabs from '@/components/nav_tabs';
import SeasonGrid from '@/components/f1/season_grid';
import WeekendView from '@/components/f1/weekend_view';
import Leaderboard from '@/components/f1/leaderboard';
import RosterManager from '@/components/f1/roster_manager';
import type { F1RaceSchedule, F1Driver, F1DriverResult, SessionType } from '@/lib/f1/types';

interface SessionInfo {
  session_type: SessionType;
  state: string;
  prediction: { p1: string; p2: string; p3: string; fastest_lap: string | null } | null;
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
  const [show_name_prompt, set_show_name_prompt] = useState(false);
  const [loading, set_loading] = useState(true);
  const [error, set_error] = useState<string | null>(null);
  const [roster, set_roster] = useState<string[]>([]);
  const [roster_loaded, set_roster_loaded] = useState(false);
  const [active_round, set_active_round] = useState<number | undefined>(undefined);
  const [completed_rounds, set_completed_rounds] = useState<number[]>([]);
  const [show_roster, set_show_roster] = useState(false);

  // Load player name from localStorage (don't show prompt yet — wait for roster)
  useEffect(() => {
    const saved = localStorage.getItem('f1_player_name');
    if (saved) {
      set_player_name(saved);
    }
  }, []);

  // Once roster is loaded, decide whether to show name prompt
  useEffect(() => {
    if (!roster_loaded) return;
    if (!player_name) {
      set_show_name_prompt(true);
    } else if (roster.length > 0 && !roster.includes(player_name)) {
      set_show_name_prompt(true);
    }
  }, [roster_loaded, roster, player_name]);

  // Save player name
  const save_player_name = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem('f1_player_name', trimmed);
    set_player_name(trimmed);
    set_show_name_prompt(false);
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
      <NavTabs />
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
        .name-prompt {
          background: rgba(0,0,0,0.85);
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .name-modal {
          background: #1e1e28;
          border: 1px solid rgba(225,6,0,0.4);
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
          max-width: 320px;
          width: 90%;
        }
        .name-input {
          width: 100%;
          background: #15151e;
          color: #e0e0e0;
          border: 1px solid rgba(225,6,0,0.3);
          border-radius: 6px;
          padding: 0.6rem;
          font-size: 1rem;
          margin: 1rem 0;
          text-align: center;
        }
        .name-input:focus {
          outline: none;
          border-color: #e10600;
        }
        .name-submit {
          background: #e10600;
          color: #ffffff;
          border: none;
          border-radius: 6px;
          padding: 0.5rem 1.5rem;
          font-weight: 700;
          cursor: pointer;
          font-size: 0.9rem;
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

        {/* Player name prompt */}
        {show_name_prompt && (
          <div className="name-prompt">
            <div className="name-modal">
              <div style={{ color: '#e10600', fontSize: '1.1rem', fontWeight: 700 }}>
                {roster.length > 0 ? 'Select Your Name' : 'Enter Your Name'}
              </div>
              <div style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                This is how you&apos;ll appear on the leaderboard
              </div>
              {roster.length > 0 ? (
                <div style={{ margin: '1rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {roster.map(name => (
                    <button
                      key={name}
                      onClick={() => save_player_name(name)}
                      style={{
                        background: 'rgba(225,6,0,0.1)',
                        border: '1px solid rgba(225,6,0,0.3)',
                        color: '#e0e0e0',
                        borderRadius: '6px',
                        padding: '0.6rem',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <input
                    className="name-input"
                    placeholder="Your name"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') save_player_name((e.target as HTMLInputElement).value);
                    }}
                  />
                  <button
                    className="name-submit"
                    onClick={() => {
                      const input = document.querySelector('.name-input') as HTMLInputElement;
                      save_player_name(input?.value || '');
                    }}
                  >
                    Let&apos;s Go
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Player bar */}
        {player_name && (
          <div className="player-bar">
            <span className="player-name">Playing as: <strong>{player_name}</strong></span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button className="change-name" onClick={() => set_show_name_prompt(true)}>
                Change
              </button>
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

        {/* Loading / Error */}
        {loading && (
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
                <Leaderboard standings={standings} season={season} />
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
      </div>
      </div>
    </>
  );
}
