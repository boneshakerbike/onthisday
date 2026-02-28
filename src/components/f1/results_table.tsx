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
  return d?.driver_code || driver_id;
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
  almost: '#888',
  miss: '#dc2626',
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
      background: '#1e1e2e',
      border: '1px solid #2a2a3a',
      borderRadius: '10px',
      overflow: 'hidden',
    }}>
      {/* Actual results banner */}
      <div style={{
        padding: '0.6rem 0.75rem',
        background: 'rgba(0,255,136,0.06)',
        borderBottom: '1px solid rgba(0,255,136,0.15)',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <span style={{ color: '#888', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Results
        </span>
        {results.slice(0, 3).map((r, i) => (
          <span key={r.driver_id} style={{ color: '#00d672', fontSize: '0.85rem', fontWeight: 600 }}>
            <span style={{ color: '#666', fontSize: '0.75rem' }}>P{i + 1}</span>{' '}
            {r.driver_code}
          </span>
        ))}
        {show_fl && fastest_lap_driver_id && (
          <span style={{ color: '#7c3aed', fontSize: '0.85rem', fontWeight: 600 }}>
            <span style={{ color: '#666', fontSize: '0.75rem' }}>FL</span>{' '}
            {driver_code(fastest_lap_driver_id, results)}
          </span>
        )}
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: show_fl ? '1fr 60px 60px 60px 50px 50px' : '1fr 60px 60px 60px 50px',
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
            gridTemplateColumns: show_fl ? '1fr 60px 60px 60px 50px 50px' : '1fr 60px 60px 60px 50px',
            padding: '0.5rem 0.75rem',
            borderBottom: idx < sorted.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
            background: idx === 0 ? 'rgba(225,6,0,0.06)' : 'transparent',
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
                      color: fl_correct ? '#7c3aed' : '#555',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                    }}>
                      {driver_code(pred.fastest_lap, results)}
                    </div>
                    <div style={{
                      color: fl_correct ? '#7c3aed' : '#555',
                      fontSize: '0.65rem',
                      opacity: 0.8,
                    }}>
                      {fl_correct ? '+3' : '+0'}
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#444', fontSize: '0.75rem' }}>—</div>
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
  color: '#666',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};
