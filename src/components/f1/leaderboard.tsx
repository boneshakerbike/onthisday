'use client';

import { useState } from 'react';

interface LeaderboardEntry {
  player_name: string;
  total_score: number;
  sessions_played: number;
}

interface LeaderboardProps {
  standings: LeaderboardEntry[];
  season: number;
}

function ScoringRules() {
  const [open, set_open] = useState(false);

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <button
        onClick={() => set_open(prev => !prev)}
        style={{
          background: 'none',
          border: 'none',
          color: '#888',
          cursor: 'pointer',
          fontSize: '0.8rem',
          padding: 0,
        }}
      >
        {open ? 'Hide' : 'How'} scoring works {open ? '\u25B2' : '\u25BC'}
      </button>
      {open && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.75rem',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '8px',
          fontSize: '0.85rem',
          lineHeight: 1.6,
        }}>
          <div style={{ color: '#e0e0e0', marginBottom: '0.5rem', fontWeight: 600 }}>Predict the top 3 for each session</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 0.75rem' }}>
            <span style={{ color: '#00d672', fontWeight: 700 }}>+5</span>
            <span style={{ color: '#ccc' }}>Perfect Match — right driver, right position</span>
            <span style={{ color: '#d4a017', fontWeight: 700 }}>+2</span>
            <span style={{ color: '#ccc' }}>Podium Lock — right driver, wrong position</span>
            <span style={{ color: '#888', fontWeight: 700 }}>+1</span>
            <span style={{ color: '#ccc' }}>Almost — driver finishes P4 or P5</span>
            <span style={{ color: '#7c3aed', fontWeight: 700 }}>+3</span>
            <span style={{ color: '#ccc' }}>Fastest Lap — bonus for race sessions only</span>
          </div>
          <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.5rem' }}>
            Max per session: 18 pts (3 perfect + fastest lap)
          </div>
        </div>
      )}
    </div>
  );
}

export default function Leaderboard({ standings, season }: LeaderboardProps) {
  if (standings.length === 0) {
    return (
      <div>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '10px',
          padding: '1.5rem',
          textAlign: 'center',
          color: '#666',
          fontSize: '0.85rem',
        }}>
          No predictions yet for {season}. Be the first to play!
        </div>
        <ScoringRules />
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '0.75rem' }}>
        Championship Standings
      </h3>
      <div style={{
        background: '#1e1e2e',
        border: '1px solid #2a2a3a',
        borderRadius: '10px',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 80px 80px',
          padding: '0.6rem 0.85rem',
          color: '#a1a1aa',
          fontSize: '0.7rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          borderBottom: '1px solid #2a2a3a',
        }}>
          <div>POS</div>
          <div>PLAYER</div>
          <div style={{ textAlign: 'right' }}>SESSIONS</div>
          <div style={{ textAlign: 'right' }}>POINTS</div>
        </div>
        {standings.map((entry, i) => (
          <div key={entry.player_name} style={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr 80px 80px',
            padding: '0.65rem 0.85rem',
            borderBottom: i < standings.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            background: i === 0 ? 'rgba(225,6,0,0.06)' : i % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
          }}>
            <div style={{
              color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#888',
              fontWeight: 700,
              fontSize: '0.9rem',
            }}>
              {i + 1}
            </div>
            <div style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: 500 }}>
              {entry.player_name}
            </div>
            <div style={{ color: '#a1a1aa', fontSize: '0.85rem', textAlign: 'right' }}>
              {entry.sessions_played}
            </div>
            <div style={{
              color: i === 0 ? '#ffffff' : '#e0e0e0',
              fontWeight: 700,
              fontSize: '0.9rem',
              textAlign: 'right',
            }}>
              {entry.total_score}
            </div>
          </div>
        ))}
      </div>
      <ScoringRules />
    </div>
  );
}
