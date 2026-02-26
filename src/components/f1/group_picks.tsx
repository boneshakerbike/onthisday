'use client';

import type { F1Driver } from '@/lib/f1/types';

interface GroupPick {
  player_name: string;
  p1: string;
  p2: string;
  p3: string;
  fastest_lap: string | null;
}

interface GroupPicksProps {
  predictions: GroupPick[];
  drivers: F1Driver[];
  show_fastest_lap: boolean;
}

function driver_label(driver_id: string, drivers: F1Driver[]): string {
  const d = drivers.find(dr => dr.driver_id === driver_id);
  return d ? `${d.code || d.family_name}` : driver_id;
}

export default function GroupPicks({ predictions, drivers, show_fastest_lap }: GroupPicksProps) {
  if (predictions.length === 0) return null;

  return (
    <div style={{
      marginTop: '0.75rem',
      padding: '0.75rem',
      background: 'rgba(225,6,0,0.05)',
      border: '1px solid rgba(225,6,0,0.15)',
      borderRadius: '8px',
    }}>
      <div style={{ color: '#e10600', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        All Picks Locked In
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${predictions.length}, 1fr)`, gap: '0.5rem' }}>
        {predictions.map(pred => (
          <div key={pred.player_name} style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '6px',
            padding: '0.5rem',
            textAlign: 'center',
          }}>
            <div style={{ color: '#e0e0e0', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              {pred.player_name}
            </div>
            <div style={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: 600 }}>
              P1: {driver_label(pred.p1, drivers)}
            </div>
            <div style={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: 600 }}>
              P2: {driver_label(pred.p2, drivers)}
            </div>
            <div style={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: 600 }}>
              P3: {driver_label(pred.p3, drivers)}
            </div>
            {show_fastest_lap && pred.fastest_lap && (
              <div style={{ color: '#A855F7', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                FL: {driver_label(pred.fastest_lap, drivers)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
