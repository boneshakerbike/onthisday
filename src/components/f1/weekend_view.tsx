'use client';

import type { F1RaceSchedule, F1Driver, SessionType, F1DriverResult } from '@/lib/f1/types';
import PredictionForm from './prediction_form';
import ResultsReveal from './results_reveal';
import GroupPicks from './group_picks';

interface GroupPick {
  player_name: string;
  p1: string;
  p2: string;
  p3: string;
  fastest_lap: string | null;
  is_locked?: boolean;
  score?: { perfect_match: number; podium_lock: number; almost: number; fastest_lap: number; total: number } | null;
}

interface GroupState {
  all_predicted: boolean;
  missing: string[];
  predictions: GroupPick[] | null;
}

interface SessionInfo {
  session_type: SessionType;
  state: string; // 'predicting' | 'watching' | 'revealed' | 'locked'
  prediction: { p1: string; p2: string; p3: string; fastest_lap: string | null; is_locked?: boolean } | null;
  score: { perfect_match: number; podium_lock: number; almost: number; fastest_lap: number; total: number } | null;
  group?: GroupState | null;
}

interface RevealData {
  results: F1DriverResult[];
  fastest_lap_driver_id: string | null;
  prediction: { p1: string; p2: string; p3: string; fastest_lap: string | null } | null;
  score: { perfect_match: number; podium_lock: number; almost: number; fastest_lap: number; total: number } | null;
}

interface WeekendViewProps {
  race: F1RaceSchedule;
  sessions: SessionInfo[];
  drivers: F1Driver[];
  revealed_data: Record<string, RevealData>;
  active_form: string | null; // session_type being predicted
  on_predict_click: (session_type: SessionType) => void;
  on_predict_cancel: () => void;
  on_predict_submit: (session_type: SessionType, p1: string, p2: string, p3: string, fastest_lap: string | null) => void;
  on_lock: (session_type: SessionType) => void;
  on_reveal: (session_type: SessionType) => void;
  submitting: boolean;
  revealing: string | null;
  on_back: () => void;
}

const session_labels: Record<string, string> = {
  sprint: 'Sprint Race',
  qualifying: 'Qualifying',
  race: 'Grand Prix',
};

function format_date(date_str: string): string {
  const d = new Date(date_str + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function WeekendView({
  race, sessions, drivers, revealed_data, active_form,
  on_predict_click, on_predict_cancel, on_predict_submit, on_lock,
  on_reveal, submitting, revealing, on_back,
}: WeekendViewProps) {
  return (
    <div>
      <button
        onClick={on_back}
        style={{
          background: 'rgba(225,6,0,0.1)',
          border: '1px solid rgba(225,6,0,0.3)',
          color: '#e10600',
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: 600,
          marginBottom: '1rem',
          padding: '0.5rem 1rem',
          borderRadius: '6px',
        }}
      >
        &larr; Back to calendar
      </button>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ color: '#ffffff', fontSize: '1.25rem', marginBottom: '0.25rem' }}>
          R{race.round} {race.race_name}
        </h2>
        <div style={{ color: '#888', fontSize: '0.85rem' }}>
          {race.circuit_name} &middot; {race.locality}, {race.country} &middot; {format_date(race.race_date)}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {sessions.map(session => {
          const reveal = revealed_data[session.session_type];
          const is_locked = session.state === 'locked';
          const is_predicting = session.state === 'predicting';
          const is_watching = session.state === 'watching';
          const is_revealed = session.state === 'revealed';
          const show_form = active_form === session.session_type;

          return (
            <div key={session.session_type} style={{
              background: is_locked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${is_locked ? '#333' : is_revealed ? 'rgba(0,255,136,0.3)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '10px',
              padding: '1rem',
              opacity: is_locked ? 0.5 : 1,
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: show_form || is_revealed || (is_predicting && !!session.prediction) ? '0.5rem' : 0,
              }}>
                <div>
                  <span style={{
                    color: is_revealed ? '#00ff88' : is_locked ? '#555' : '#e0e0e0',
                    fontWeight: 600,
                    fontSize: '1rem',
                  }}>
                    {session_labels[session.session_type] || session.session_type}
                  </span>
                  {is_revealed && session.score && (
                    <span style={{ color: '#ffffff', marginLeft: '0.75rem', fontWeight: 700, fontSize: '0.9rem' }}>
                      {session.score.total} pts
                    </span>
                  )}
                </div>

                <div>
                  {is_locked && (
                    <span style={{ color: '#555', fontSize: '0.8rem' }}>
                      Complete previous session first
                    </span>
                  )}
                  {/* predicting + no saved picks: show Make Prediction */}
                  {is_predicting && !show_form && !session.prediction && (
                    <button
                      onClick={() => on_predict_click(session.session_type)}
                      style={{
                        background: '#e10600',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.4rem 0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      Make Prediction
                    </button>
                  )}
                  {/* predicting + saved picks: Edit Picks + Lock In */}
                  {is_predicting && !show_form && session.prediction && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        onClick={() => on_predict_click(session.session_type)}
                        style={{
                          background: 'none',
                          border: '1px solid rgba(225,6,0,0.3)',
                          color: '#e10600',
                          borderRadius: '4px',
                          padding: '0.3rem 0.6rem',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}
                      >
                        Edit Picks
                      </button>
                      <button
                        onClick={() => on_lock(session.session_type)}
                        disabled={submitting}
                        style={{
                          background: submitting ? '#444' : '#e10600',
                          color: submitting ? '#888' : '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.3rem 0.6rem',
                          fontWeight: 700,
                          cursor: submitting ? 'wait' : 'pointer',
                          fontSize: '0.8rem',
                        }}
                      >
                        Lock In
                      </button>
                    </div>
                  )}
                  {is_watching && session.group && !session.group.all_predicted && (
                    <span style={{ color: '#e10600', fontSize: '0.8rem' }}>
                      Waiting for {session.group.missing.join(', ')}
                    </span>
                  )}
                  {is_watching && (!session.group || session.group.all_predicted) && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                        Watch the {session_labels[session.session_type]?.toLowerCase() || session.session_type}, then reveal when ready.
                      </div>
                      <button
                        onClick={() => on_reveal(session.session_type)}
                        disabled={revealing === session.session_type}
                        style={{
                          background: revealing === session.session_type ? '#444' : '#ffffff',
                          color: revealing === session.session_type ? '#888' : '#15151e',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.4rem 0.75rem',
                          fontWeight: 700,
                          cursor: revealing === session.session_type ? 'wait' : 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        {revealing === session.session_type ? 'Fetching...' : 'Reveal Results'}
                      </button>
                    </div>
                  )}
                  {is_revealed && (
                    <span style={{ color: '#00ff88', fontSize: '0.8rem' }}>Revealed</span>
                  )}
                </div>
              </div>

              {/* Saved picks summary (predicting + has saved picks, form not open) */}
              {is_predicting && !show_form && session.prediction && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: '0.9rem' }}>
                    {[session.prediction.p1, session.prediction.p2, session.prediction.p3]
                      .map(id => drivers.find(d => d.driver_id === id)?.code || id)
                      .join(' / ')}
                    {session.session_type === 'race' && session.prediction.fastest_lap && (
                      <span style={{ color: '#666', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                        FL: {drivers.find(d => d.driver_id === session.prediction!.fastest_lap)?.code || session.prediction.fastest_lap}
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                    Picks saved. Lock in when ready to watch.
                  </div>
                </div>
              )}

              {/* Prediction form (inline) */}
              {show_form && (
                <PredictionForm
                  drivers={drivers}
                  session_type={session.session_type}
                  on_submit={(p1, p2, p3, fl) => on_predict_submit(session.session_type, p1, p2, p3, fl)}
                  on_cancel={on_predict_cancel}
                  submitting={submitting}
                  existing_prediction={session.prediction}
                />
              )}

              {/* Revealed results — show all players when group data available */}
              {is_revealed && reveal && session.group?.predictions && session.group.predictions.length > 0 ? (
                session.group.predictions.map((gp: GroupPick) => (
                  <ResultsReveal
                    key={gp.player_name}
                    results={reveal.results}
                    prediction={{ p1: gp.p1, p2: gp.p2, p3: gp.p3, fastest_lap: gp.fastest_lap }}
                    score={gp.score || null}
                    fastest_lap_driver_id={reveal.fastest_lap_driver_id}
                    session_type={session.session_type}
                    player_name={gp.player_name}
                  />
                ))
              ) : is_revealed && reveal ? (
                <ResultsReveal
                  results={reveal.results}
                  prediction={reveal.prediction || session.prediction}
                  score={reveal.score || session.score}
                  fastest_lap_driver_id={reveal.fastest_lap_driver_id}
                  session_type={session.session_type}
                />
              ) : null}

              {/* Group picks — visible in predicting and watching states (before reveal) */}
              {(is_predicting || is_watching) && !show_form && session.group?.predictions && session.group.predictions.length > 0 && (
                <GroupPicks
                  predictions={session.group.predictions}
                  drivers={drivers}
                  show_fastest_lap={session.session_type === 'race'}
                />
              )}
              {/* Solo watching — no group */}
              {is_watching && !show_form && !session.group && session.prediction && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '6px',
                  color: '#888',
                  fontSize: '0.85rem',
                }}>
                  Prediction locked. Watch the session, then click Reveal when ready.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
