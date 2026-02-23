'use client';

interface LeaderboardEntry {
  player_name: string;
  total_score: number;
  sessions_played: number;
}

interface LeaderboardProps {
  standings: LeaderboardEntry[];
  season: number;
}

export default function Leaderboard({ standings, season }: LeaderboardProps) {
  if (standings.length === 0) {
    return (
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
    );
  }

  return (
    <div>
      <h3 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '0.75rem' }}>
        Championship Standings
      </h3>
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '10px',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 80px 80px',
          padding: '0.5rem 0.75rem',
          color: '#666',
          fontSize: '0.7rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
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
            padding: '0.6rem 0.75rem',
            borderBottom: i < standings.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
            background: i === 0 ? 'rgba(225,6,0,0.08)' : 'transparent',
          }}>
            <div style={{
              color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#888',
              fontWeight: 700,
              fontSize: '0.9rem',
            }}>
              {i + 1}
            </div>
            <div style={{ color: '#e0e0e0', fontSize: '0.9rem' }}>
              {entry.player_name}
            </div>
            <div style={{ color: '#888', fontSize: '0.85rem', textAlign: 'right' }}>
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
    </div>
  );
}
