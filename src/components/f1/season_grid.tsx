'use client';

import type { F1RaceSchedule } from '@/lib/f1/types';

interface SeasonGridProps {
  races: F1RaceSchedule[];
  season: number;
  on_select_round: (round: number) => void;
}

const country_flags: Record<string, string> = {
  'Australia': 'AU', 'Bahrain': 'BH', 'Saudi Arabia': 'SA', 'Japan': 'JP',
  'China': 'CN', 'USA': 'US', 'United States': 'US', 'Italy': 'IT',
  'Monaco': 'MC', 'Canada': 'CA', 'Spain': 'ES', 'Austria': 'AT',
  'UK': 'GB', 'Hungary': 'HU', 'Belgium': 'BE', 'Netherlands': 'NL',
  'Singapore': 'SG', 'Azerbaijan': 'AZ', 'Mexico': 'MX', 'Brazil': 'BR',
  'Qatar': 'QA', 'UAE': 'AE', 'Las Vegas': 'US',
};

function get_flag(country: string): string {
  const code = country_flags[country];
  if (!code) return '';
  return code
    .toUpperCase()
    .split('')
    .map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

function format_date(date_str: string): string {
  const d = new Date(date_str + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SeasonGrid({ races, on_select_round }: SeasonGridProps) {
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h3 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
        Race Calendar
      </h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '0.75rem',
      }}>
        {races.map(race => (
          <button
            key={race.round}
            onClick={() => on_select_round(race.round)}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '0.75rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.2s, background 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#e10600';
              e.currentTarget.style.background = 'rgba(225,6,0,0.08)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.25rem' }}>
              R{race.round} {get_flag(race.country)}
            </div>
            <div style={{ color: '#e0e0e0', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              {race.race_name.replace(' Grand Prix', ' GP')}
            </div>
            <div style={{ color: '#888', fontSize: '0.7rem' }}>
              {format_date(race.race_date)}
              {race.is_sprint_weekend && (
                <span style={{
                  marginLeft: '0.4rem',
                  background: '#e10600',
                  color: '#fff',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                }}>
                  SPRINT
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
