'use client';

import { useState } from 'react';

interface RosterManagerProps {
  season: number;
  round: number | null;
  roster: string[];
  on_roster_change: (roster: string[]) => void;
  on_season_reset?: () => void;
}

export default function RosterManager({ season, round, roster, on_roster_change, on_season_reset }: RosterManagerProps) {
  const [new_name, set_new_name] = useState('');
  const [busy, set_busy] = useState(false);
  const [poke_result, set_poke_result] = useState<string | null>(null);

  const poke_the_bear = async () => {
    if (!round) { alert('Select a round first'); return; }
    set_busy(true);
    set_poke_result(null);
    try {
      const res = await fetch('/api/f1/mr-bear/poke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, round }),
      });
      const data = await res.json();
      if (!res.ok) {
        set_poke_result(data.error || 'Failed');
        return;
      }
      if (data.generated.length === 0) {
        set_poke_result('Mr Bear already has picks for this weekend');
      } else {
        const parts = data.generated.map((st: string) => {
          const p = data.picks[st];
          const label = st === 'race' ? 'Race' : st === 'qualifying' ? 'Qual' : st === 'sprint' ? 'Sprint' : 'SQ';
          const fl = p.fastest_lap ? `, FL: ${p.fastest_lap}` : '';
          return `${label}: ${p.p1}, ${p.p2}, ${p.p3}${fl}`;
        });
        set_poke_result(`Mr Bear picked — ${parts.join(' | ')}`);
      }
    } catch {
      set_poke_result('Failed to poke the bear');
    } finally {
      set_busy(false);
    }
  };

  const reset_season = async () => {
    if (!confirm(`Reset all predictions, scores, and player states for ${season}? This cannot be undone.`)) return;
    set_busy(true);
    try {
      const res = await fetch('/api/f1/roster', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, action: 'reset' }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Cleared: ${data.deleted.predictions} predictions, ${data.deleted.scores} scores, ${data.deleted.states} states`);
        if (on_season_reset) on_season_reset();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reset');
      }
    } catch {
      alert('Failed to reset season');
    } finally {
      set_busy(false);
    }
  };

  const add_player = async () => {
    const name = new_name.trim();
    if (!name) return;
    set_busy(true);
    try {
      const res = await fetch('/api/f1/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, player_name: name }),
      });
      if (res.ok) {
        const data = await res.json();
        on_roster_change(data.roster);
        set_new_name('');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add player');
      }
    } catch {
      alert('Failed to add player');
    } finally {
      set_busy(false);
    }
  };

  const add_mr_bear = async () => {
    set_busy(true);
    try {
      const res = await fetch('/api/f1/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, player_name: 'Mr Bear' }),
      });
      if (res.ok) {
        const data = await res.json();
        on_roster_change(data.roster);
      }
    } catch {
      alert('Failed to add Mr Bear');
    } finally {
      set_busy(false);
    }
  };

  const remove_player = async (name: string) => {
    set_busy(true);
    try {
      const res = await fetch('/api/f1/roster', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, player_name: name }),
      });
      if (res.ok) {
        const data = await res.json();
        on_roster_change(data.roster);
      }
    } catch {
      alert('Failed to remove player');
    } finally {
      set_busy(false);
    }
  };

  return (
    <div style={{
      marginBottom: '1.5rem',
      padding: '0.75rem',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: '10px',
    }}>
      <div style={{ color: '#e10600', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>
        Roster Manager
      </div>
      <div style={{ color: '#d1d5db', fontSize: '0.7rem', marginBottom: '0.5rem' }}>
        Add yourself first before adding other players.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
        {roster.map(name => (
          <span key={name} style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
            padding: '0.25rem 0.5rem',
            fontSize: '0.8rem',
            color: '#e0e0e0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}>
            {name}
            <button
              onClick={() => remove_player(name)}
              disabled={busy}
              style={{
                background: 'none',
                border: 'none',
                color: '#e10600',
                cursor: 'pointer',
                fontSize: '0.9rem',
                padding: 0,
                lineHeight: 1,
              }}
            >
              x
            </button>
          </span>
        ))}
        {roster.length === 0 && (
          <span style={{ color: '#d1d5db', fontSize: '0.8rem' }}>No players added yet</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <input
          value={new_name}
          onChange={e => set_new_name(e.target.value)}
          placeholder="Player name"
          onKeyDown={e => { if (e.key === 'Enter') add_player(); }}
          style={{
            flex: 1,
            background: '#111111',
            color: '#e0e0e0',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            padding: '0.4rem 0.6rem',
            fontSize: '0.8rem',
          }}
        />
        <button
          onClick={add_player}
          disabled={busy || !new_name.trim()}
          style={{
            background: '#e10600',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '0.4rem 0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.8rem',
            opacity: busy || !new_name.trim() ? 0.5 : 1,
          }}
        >
          Add
        </button>
        {!roster.includes('Mr Bear') && (
          <button
            onClick={() => { set_new_name(''); add_mr_bear(); }}
            disabled={busy}
            style={{
              background: 'rgba(139,90,43,0.2)',
              border: '1px solid rgba(139,90,43,0.4)',
              color: '#d4a574',
              borderRadius: '6px',
              padding: '0.4rem 0.75rem',
              fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
              opacity: busy ? 0.5 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            + Mr Bear
          </button>
        )}
      </div>
      {roster.includes('Mr Bear') && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={poke_the_bear}
              disabled={busy || !round}
              style={{
                background: 'rgba(139,90,43,0.2)',
                border: '1px solid rgba(139,90,43,0.4)',
                color: '#d4a574',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                cursor: busy || !round ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                opacity: busy || !round ? 0.5 : 1,
              }}
            >
              Poke the Bear
            </button>
            {!round && <span style={{ color: '#d1d5db', fontSize: '0.7rem' }}>Select a round first</span>}
          </div>
          {poke_result && (
            <div style={{ color: '#d4a574', fontSize: '0.75rem', marginTop: '0.35rem' }}>
              {poke_result}
            </div>
          )}
        </div>
      )}
      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button
          onClick={reset_season}
          disabled={busy}
          style={{
            background: 'none',
            border: '1px solid rgba(255,68,102,0.3)',
            color: '#ff4466',
            borderRadius: '6px',
            padding: '0.35rem 0.75rem',
            cursor: 'pointer',
            fontSize: '0.75rem',
            opacity: busy ? 0.5 : 1,
          }}
        >
          Reset {season} Season Data
        </button>
      </div>
    </div>
  );
}
