'use client';

import type { F1RaceSchedule } from '@/lib/f1/types';

interface SeasonGridProps {
  races: F1RaceSchedule[];
  season: number;
  on_select_round: (round: number) => void;
  active_round?: number;
  completed_rounds?: number[];
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

export default function SeasonGrid({ races, on_select_round, active_round, completed_rounds = [] }: SeasonGridProps) {
  const has_locking = active_round !== undefined;
  const completed_set = new Set(completed_rounds);

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h3 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
        Race Calendar
      </h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
      }}>
        {races.map(race => {
          const is_completed = completed_set.has(race.round);
          const is_active = has_locking && race.round === active_round;
          const is_future = has_locking && !is_completed && !is_active;

          return (
            <button
              key={race.round}
              onClick={() => {
                if (is_future) return;
                on_select_round(race.round);
              }}
              style={{
                background: is_future ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${is_active ? 'rgba(225,6,0,0.4)' : 'rgba(255,255,255,0.05)'}`,
                borderRadius: '10px',
                padding: '0.85rem',
                cursor: is_future ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.2s, background 0.2s',
                opacity: is_future ? 0.4 : 1,
              }}
              onMouseEnter={e => {
                if (is_future) return;
                e.currentTarget.style.borderColor = '#e10600';
                e.currentTarget.style.background = 'rgba(225,6,0,0.08)';
              }}
              onMouseLeave={e => {
                if (is_future) return;
                e.currentTarget.style.borderColor = is_active ? 'rgba(225,6,0,0.4)' : 'rgba(255,255,255,0.05)';
                e.currentTarget.style.background = is_future ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)';
              }}
            >
              <div style={{ fontSize: '0.7rem', color: '#d1d5db', marginBottom: '0.3rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>R{race.round} {get_flag(race.country)}</span>
                {is_completed && (
                  <span style={{ color: '#d1d5db', fontSize: '0.6rem', fontWeight: 700, background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '3px' }}>DONE</span>
                )}
                {is_active && (
                  <span style={{ color: '#e10600', fontSize: '0.6rem', fontWeight: 700, background: 'rgba(225,6,0,0.1)', padding: '1px 5px', borderRadius: '3px' }}>NEXT</span>
                )}
              </div>
              <div style={{ color: is_future ? '#d1d5db' : '#ffffff', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                {race.race_name.replace(' Grand Prix', ' GP')}
              </div>
              <div style={{ color: '#d1d5db', fontSize: '0.75rem' }}>
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
          );
        })}
      </div>
    </div>
  );
}
