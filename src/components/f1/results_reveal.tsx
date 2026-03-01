'use client';

import type { F1DriverResult } from '@/lib/f1/types';

interface ResultsRevealProps {
  results: F1DriverResult[];
  prediction: { p1: string; p2: string; p3: string; fastest_lap: string | null } | null;
  score: {
    perfect_match: number;
    podium_lock: number;
    almost: number;
    fastest_lap: number;
    total: number;
  } | null;
  fastest_lap_driver_id: string | null;
  session_type: string;
  player_name?: string;
}

function score_color(pick: string, position: number, actual_podium: string[], actual_p4_p5: string[]): string {
  if (pick === actual_podium[position]) return '#00d672'; // perfect match - green
  if (actual_podium.includes(pick)) return '#d4a017';     // podium lock - amber/gold
  if (actual_p4_p5.includes(pick)) return '#bbb';         // almost - gray
  return '#777';                                            // miss - dim
}

function score_label(pick: string, position: number, actual_podium: string[], actual_p4_p5: string[]): string {
  if (pick === actual_podium[position]) return '+5 Perfect';
  if (actual_podium.includes(pick)) return '+2 Podium';
  if (actual_p4_p5.includes(pick)) return '+1 Almost';
  return '+0';
}

function driver_display(driver_id: string, results: F1DriverResult[]): string {
  const d = results.find(r => r.driver_id === driver_id);
  if (!d) return driver_id;
  return `${d.driver_code} - ${d.given_name} ${d.family_name}`;
}

export default function ResultsReveal({
  results, prediction, score, fastest_lap_driver_id, session_type, player_name,
}: ResultsRevealProps) {
  const pick_label = player_name ? player_name.toUpperCase() : 'YOUR PICK';
  const actual_podium = results.slice(0, 3).map(r => r.driver_id);
  const actual_p4_p5 = results.slice(3, 5).map(r => r.driver_id);
  const picks = prediction ? [prediction.p1, prediction.p2, prediction.p3] : [];
  const positions = ['P1', 'P2', 'P3'];

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: '10px',
      padding: '1.25rem',
      marginTop: '0.75rem',
    }}>
      {/* Podium comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
        {positions.map((pos, i) => {
          const actual_driver = results[i];
          const pick = picks[i];
          const color = pick ? score_color(pick, i, actual_podium, actual_p4_p5) : '#666';
          const label = pick ? score_label(pick, i, actual_podium, actual_p4_p5) : '';

          return (
            <div key={pos} style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 1fr auto',
              gap: '0.5rem',
              alignItems: 'center',
              padding: '0.5rem',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '6px',
              borderLeft: `3px solid ${color}`,
            }}>
              <div style={{ color: '#bbb', fontWeight: 700, fontSize: '0.9rem' }}>{pos}</div>
              <div>
                <div style={{ color: '#bbb', fontSize: '0.65rem' }}>{pick_label}</div>
                <div style={{ color: pick ? '#e0e0e0' : '#aaa', fontSize: '0.85rem' }}>
                  {pick ? driver_display(pick, results) : 'No pick'}
                </div>
              </div>
              <div>
                <div style={{ color: '#bbb', fontSize: '0.65rem' }}>ACTUAL</div>
                <div style={{ color: '#e0e0e0', fontSize: '0.85rem' }}>
                  {actual_driver ? `${actual_driver.driver_code} - ${actual_driver.given_name} ${actual_driver.family_name}` : '-'}
                </div>
              </div>
              <div style={{
                color,
                fontWeight: 700,
                fontSize: '0.8rem',
                textAlign: 'right',
                minWidth: '70px',
              }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fastest lap (race only) */}
      {session_type === 'race' && prediction?.fastest_lap && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.5rem',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '6px',
          borderLeft: `3px solid ${prediction.fastest_lap === fastest_lap_driver_id ? '#7c3aed' : '#555'}`,
          display: 'grid',
          gridTemplateColumns: '40px 1fr 1fr auto',
          gap: '0.5rem',
          alignItems: 'center',
        }}>
          <div style={{ color: '#bbb', fontWeight: 700, fontSize: '0.85rem' }}>FL</div>
          <div>
            <div style={{ color: '#888', fontSize: '0.65rem' }}>{pick_label}</div>
            <div style={{ color: '#e0e0e0', fontSize: '0.85rem' }}>
              {driver_display(prediction.fastest_lap, results)}
            </div>
          </div>
          <div>
            <div style={{ color: '#888', fontSize: '0.65rem' }}>ACTUAL</div>
            <div style={{ color: '#e0e0e0', fontSize: '0.85rem' }}>
              {fastest_lap_driver_id ? driver_display(fastest_lap_driver_id, results) : 'N/A'}
            </div>
          </div>
          <div style={{
            color: prediction.fastest_lap === fastest_lap_driver_id ? '#7c3aed' : '#555',
            fontWeight: 700,
            fontSize: '0.8rem',
            textAlign: 'right',
            minWidth: '70px',
          }}>
            {prediction.fastest_lap === fastest_lap_driver_id ? '+3 FL Bonus' : '+0'}
          </div>
        </div>
      )}

      {/* Total score */}
      {score && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: 'rgba(225,6,0,0.1)',
          borderRadius: '8px',
          textAlign: 'center',
        }}>
          <div style={{ color: '#bbb', fontSize: '0.75rem', marginBottom: '0.25rem' }}>SESSION TOTAL</div>
          <div style={{ color: '#ffffff', fontSize: '2rem', fontWeight: 700 }}>
            {score.total} pts
          </div>
          <div style={{ color: '#bbb', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {score.perfect_match > 0 && `${score.perfect_match} perfect `}
            {score.podium_lock > 0 && `${score.podium_lock} podium `}
            {score.almost > 0 && `${score.almost} almost `}
            {score.fastest_lap > 0 && '+FL bonus'}
          </div>
        </div>
      )}

      {!prediction && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '8px',
          textAlign: 'center',
          color: '#bbb',
          fontSize: '0.85rem',
        }}>
          No prediction was made for this session
        </div>
      )}
    </div>
  );
}
