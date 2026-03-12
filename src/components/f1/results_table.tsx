'use client';

import type { F1DriverResult } from '@/lib/f1/types';

interface GroupPick {
  player_name: string;
  p1: string;
  p2: string;
  p3: string;
  fastest_lap: string | null;
  score?: { perfect_match: number; podium_lock: number; almost: number; fastest_lap: number; total: number } | null;
}

interface ResultsTableProps {
  results: F1DriverResult[];
  predictions: GroupPick[];
  fastest_lap_driver_id: string | null;
  session_type: string;
}

function driver_code(driver_id: string, results: F1DriverResult[]): string {
  const d = results.find(r => r.driver_id === driver_id);
  return d?.driver_code || 'N/A';
}

type PickGrade = 'perfect' | 'podium' | 'almost' | 'miss';

function grade_pick(pick: string, position: number, podium: string[], p4_p5: string[]): PickGrade {
  if (pick === podium[position]) return 'perfect';
  if (podium.includes(pick)) return 'podium';
  if (p4_p5.includes(pick)) return 'almost';
  return 'miss';
}

const grade_colors: Record<PickGrade, string> = {
  perfect: '#00d672',
  podium: '#d4a017',
  almost: '#d1d5db',
  miss: '#999',
};

const grade_points: Record<PickGrade, string> = {
  perfect: '+5',
  podium: '+2',
  almost: '+1',
  miss: '+0',
};

export default function ResultsTable({
  results, predictions, fastest_lap_driver_id, session_type,
}: ResultsTableProps) {
  const podium = results.slice(0, 3).map(r => r.driver_id);
  const p4_p5 = results.slice(3, 5).map(r => r.driver_id);
  const show_fl = session_type === 'race';
  const sorted = [...predictions].sort((a, b) => (b.score?.total || 0) - (a.score?.total || 0));

  return (
    <div style={{
      marginTop: '0.75rem',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: '10px',
    }}>
      {/* Actual results banner */}
      <div style={{
        padding: '0.6rem 0.75rem',
        background: 'rgba(0,255,136,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <span style={{ color: '#d1d5db', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Results
        </span>
        {results.slice(0, 3).map((r, i) => (
          <span key={r.driver_id} style={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: 600 }}>
            <span style={{ color: '#d1d5db', fontSize: '0.75rem' }}>P{i + 1}</span>{' '}
            {r.driver_code}
          </span>
        ))}
        {show_fl && fastest_lap_driver_id && (
          <span style={{ color: '#a78bfa', fontSize: '0.85rem', fontWeight: 600 }}>
            <span style={{ color: '#d1d5db', fontSize: '0.75rem' }}>FL</span>{' '}
            {driver_code(fastest_lap_driver_id, results)}
          </span>
        )}
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: show_fl ? '1fr 44px 44px 44px 38px 40px' : '1fr 50px 50px 50px 44px',
        padding: '0.4rem 0.75rem',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={header_style}>Player</div>
        <div style={{ ...header_style, textAlign: 'center' }}>P1</div>
        <div style={{ ...header_style, textAlign: 'center' }}>P2</div>
        <div style={{ ...header_style, textAlign: 'center' }}>P3</div>
        {show_fl && <div style={{ ...header_style, textAlign: 'center' }}>FL</div>}
        <div style={{ ...header_style, textAlign: 'right' }}>PTS</div>
      </div>

      {/* Player rows */}
      {sorted.map((pred, idx) => {
        const picks = [pred.p1, pred.p2, pred.p3];
        const grades = picks.map((pick, i) => grade_pick(pick, i, podium, p4_p5));
        const fl_correct = show_fl && pred.fastest_lap === fastest_lap_driver_id;

        return (
          <div key={pred.player_name} style={{
            display: 'grid',
            gridTemplateColumns: show_fl ? '1fr 44px 44px 44px 38px 40px' : '1fr 50px 50px 50px 44px',
            padding: '0.5rem 0.75rem',
            borderBottom: idx < sorted.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
            background: 'transparent',
          }}>
            {/* Player name */}
            <div style={{
              color: '#e0e0e0',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
            }}>
              {pred.player_name}
            </div>

            {/* P1, P2, P3 cells */}
            {picks.map((pick, i) => (
              <div key={i} style={{
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <div style={{
                  color: grade_colors[grades[i]],
                  fontSize: '0.85rem',
                  fontWeight: 700,
                }}>
                  {driver_code(pick, results)}
                </div>
                <div style={{
                  color: grade_colors[grades[i]],
                  fontSize: '0.65rem',
                  opacity: 0.8,
                }}>
                  {grade_points[grades[i]]}
                </div>
              </div>
            ))}

            {/* FL cell */}
            {show_fl && (
              <div style={{
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {pred.fastest_lap ? (
                  <>
                    <div style={{
                      color: fl_correct ? '#a78bfa' : '#d1d5db',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                    }}>
                      {driver_code(pred.fastest_lap, results)}
                    </div>
                    <div style={{
                      color: fl_correct ? '#a78bfa' : '#d1d5db',
                      fontSize: '0.65rem',
                      opacity: 0.8,
                    }}>
                      {fl_correct ? '+3' : '+0'}
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#d1d5db', fontSize: '0.75rem' }}>—</div>
                )}
              </div>
            )}

            {/* Total */}
            <div style={{
              textAlign: 'right',
              color: idx === 0 ? '#ffffff' : '#e0e0e0',
              fontWeight: 700,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}>
              {pred.score?.total ?? '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const header_style: React.CSSProperties = {
  color: '#d1d5db',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};
