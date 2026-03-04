'use client';

import { useEffect, useState } from 'react';
import type { F1RaceSchedule, F1CancelledRound } from '@/lib/f1/types';

interface RosterManagerProps {
  season: number;
  round: number | null;
  roster: string[];
  races: F1RaceSchedule[];
  cancelled_rounds: F1CancelledRound[];
  on_roster_change: (roster: string[]) => void;
  on_schedule_change?: () => void;
  on_season_reset?: () => void;
}

export default function RosterManager({
  season,
  round,
  roster,
  races,
  cancelled_rounds,
  on_roster_change,
  on_schedule_change,
  on_season_reset,
}: RosterManagerProps) {
  const [new_name, set_new_name] = useState('');
  const [busy, set_busy] = useState(false);
  const [poke_result, set_poke_result] = useState<string | null>(null);
  const [rookies_open, set_rookies_open] = useState(false);
  const [rookie_driver_names, set_rookie_driver_names] = useState<Record<string, string>>({});
  const [selected_rookies, set_selected_rookies] = useState<string[]>([]);
  const [rookies_loading, set_rookies_loading] = useState(false);
  const [rookies_saving, set_rookies_saving] = useState(false);
  const [rookies_message, set_rookies_message] = useState<string | null>(null);
  const [cancel_round_choice, set_cancel_round_choice] = useState('');
  const [cancel_message, set_cancel_message] = useState<string | null>(null);

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

  useEffect(() => {
    if (!rookies_open) return;
    let cancelled = false;
    const run = async () => {
      set_rookies_loading(true);
      set_rookies_message(null);
      try {
        const res = await fetch(`/api/f1/mr-bear/rookies?season=${season}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          set_rookies_message(data.error || 'Failed to load rookies');
          return;
        }
        set_selected_rookies(Array.isArray(data.rookies) ? data.rookies : []);
        set_rookie_driver_names((data.driver_names && typeof data.driver_names === 'object') ? data.driver_names : {});
      } catch {
        if (!cancelled) set_rookies_message('Failed to load rookies');
      } finally {
        if (!cancelled) set_rookies_loading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [rookies_open, season]);

  useEffect(() => {
    if (races.length === 0) return;
    set_cancel_round_choice(String(races[0].round));
  }, [races]);

  const toggle_rookie = (driver_id: string) => {
    set_selected_rookies(prev => (
      prev.includes(driver_id)
        ? prev.filter(id => id !== driver_id)
        : [...prev, driver_id]
    ));
  };

  const save_rookies = async () => {
    set_rookies_saving(true);
    set_rookies_message(null);
    try {
      const res = await fetch('/api/f1/mr-bear/rookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, driver_ids: selected_rookies }),
      });
      const data = await res.json();
      if (!res.ok) {
        set_rookies_message(data.error || 'Failed to save rookies');
        return;
      }
      set_selected_rookies(Array.isArray(data.rookies) ? data.rookies : selected_rookies);
      set_rookies_message('Saved Mr Bear rookies');
    } catch {
      set_rookies_message('Failed to save rookies');
    } finally {
      set_rookies_saving(false);
    }
  };

  const cancel_round = async () => {
    const selected = parseInt(cancel_round_choice, 10);
    if (!selected) return;
    set_busy(true);
    set_cancel_message(null);
    try {
      const res = await fetch('/api/f1/admin/cancel-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, round: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        set_cancel_message(data.error || 'Failed to cancel round');
        return;
      }
      set_cancel_message(`Cancelled round ${selected}`);
      if (on_schedule_change) on_schedule_change();
    } catch {
      set_cancel_message('Failed to cancel round');
    } finally {
      set_busy(false);
    }
  };

  const uncancel_round = async (circuit_id: string, race_name: string) => {
    set_busy(true);
    set_cancel_message(null);
    try {
      const res = await fetch('/api/f1/admin/cancel-round', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, circuit_id }),
      });
      const data = await res.json();
      if (!res.ok) {
        set_cancel_message(data.error || 'Failed to un-cancel round');
        return;
      }
      set_cancel_message(`Restored ${race_name}`);
      if (on_schedule_change) on_schedule_change();
    } catch {
      set_cancel_message('Failed to un-cancel round');
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

  const rookie_driver_entries = Object.entries(rookie_driver_names)
    .sort((a, b) => a[1].localeCompare(b[1]));
  const admin_cancelled_rounds = cancelled_rounds.filter(r => r.source === 'admin');

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
          onClick={() => set_rookies_open(prev => !prev)}
          disabled={busy || rookies_saving}
          style={{
            background: 'rgba(139,90,43,0.15)',
            border: '1px solid rgba(139,90,43,0.35)',
            color: '#d4a574',
            borderRadius: '6px',
            padding: '0.35rem 0.75rem',
            cursor: busy || rookies_saving ? 'not-allowed' : 'pointer',
            fontSize: '0.78rem',
            fontWeight: 600,
            opacity: busy || rookies_saving ? 0.5 : 1,
          }}
        >
          {rookies_open ? 'Hide Mr Bear Rookies' : 'Mr Bear Rookies'}
        </button>
        {rookies_open && (
          <div style={{
            marginTop: '0.6rem',
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '8px',
            padding: '0.6rem',
          }}>
            {rookies_loading ? (
              <div style={{ color: '#d1d5db', fontSize: '0.75rem' }}>Loading drivers...</div>
            ) : rookie_driver_entries.length === 0 ? (
              <div style={{ color: '#d1d5db', fontSize: '0.75rem' }}>No drivers found for {season}</div>
            ) : (
              <div style={{ maxHeight: '210px', overflowY: 'auto', display: 'grid', gap: '0.35rem' }}>
                {rookie_driver_entries.map(([driver_id, name]) => (
                  <label
                    key={driver_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      color: '#e0e0e0',
                      fontSize: '0.78rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected_rookies.includes(driver_id)}
                      onChange={() => toggle_rookie(driver_id)}
                      disabled={busy || rookies_saving}
                    />
                    <span>{name}</span>
                    <span style={{ color: '#a1a1aa', fontSize: '0.72rem' }}>({driver_id})</span>
                  </label>
                ))}
              </div>
            )}
            <div style={{ marginTop: '0.55rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={save_rookies}
                disabled={busy || rookies_loading || rookies_saving}
                style={{
                  background: 'rgba(139,90,43,0.2)',
                  border: '1px solid rgba(139,90,43,0.4)',
                  color: '#d4a574',
                  borderRadius: '6px',
                  padding: '0.3rem 0.7rem',
                  cursor: busy || rookies_loading || rookies_saving ? 'not-allowed' : 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  opacity: busy || rookies_loading || rookies_saving ? 0.5 : 1,
                }}
              >
                {rookies_saving ? 'Saving...' : 'Save Rookies'}
              </button>
              {rookies_message && (
                <span style={{ color: '#d1d5db', fontSize: '0.72rem' }}>
                  {rookies_message}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ color: '#d1d5db', fontSize: '0.72rem', marginBottom: '0.4rem' }}>
          Skipped weekends (admin override)
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={cancel_round_choice}
            onChange={e => set_cancel_round_choice(e.target.value)}
            disabled={busy || races.length === 0}
            style={{
              flex: 1,
              minWidth: '220px',
              background: '#111111',
              color: '#e0e0e0',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              padding: '0.35rem 0.5rem',
              fontSize: '0.75rem',
            }}
          >
            {races.map(r => (
              <option key={`${r.round}_${r.circuit_id}`} value={r.round}>
                R{r.round} — {r.race_name}
              </option>
            ))}
          </select>
          <button
            onClick={cancel_round}
            disabled={busy || races.length === 0 || !cancel_round_choice}
            style={{
              background: 'rgba(255,68,102,0.15)',
              border: '1px solid rgba(255,68,102,0.35)',
              color: '#fda4af',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              cursor: busy || races.length === 0 || !cancel_round_choice ? 'not-allowed' : 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
              opacity: busy || races.length === 0 || !cancel_round_choice ? 0.5 : 1,
            }}
          >
            Cancel Round
          </button>
        </div>
        {admin_cancelled_rounds.length > 0 && (
          <div style={{ marginTop: '0.55rem', display: 'grid', gap: '0.35rem' }}>
            {admin_cancelled_rounds.map(cr => (
              <div
                key={`${cr.circuit_id}_${cr.source}`}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px',
                  padding: '0.35rem 0.45rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                }}
              >
                <span style={{ color: '#fca5a5', fontSize: '0.73rem' }}>
                  R{cr.round} — {cr.race_name}
                </span>
                <button
                  onClick={() => uncancel_round(cr.circuit_id, cr.race_name)}
                  disabled={busy}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(163,230,53,0.3)',
                    color: '#bef264',
                    borderRadius: '5px',
                    padding: '0.2rem 0.5rem',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  Un-cancel
                </button>
              </div>
            ))}
          </div>
        )}
        {cancel_message && (
          <div style={{ marginTop: '0.45rem', color: '#d1d5db', fontSize: '0.72rem' }}>
            {cancel_message}
          </div>
        )}
      </div>
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
