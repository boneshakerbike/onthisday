'use client';

import { useState, useRef, useEffect } from 'react';
import type { F1Driver, SessionType } from '@/lib/f1/types';

interface PredictionFormProps {
  drivers: F1Driver[];
  session_type: SessionType;
  on_submit: (p1: string, p2: string, p3: string, fastest_lap: string | null) => void;
  on_cancel: () => void;
  submitting: boolean;
  existing_prediction?: { p1: string; p2: string; p3: string; fastest_lap: string | null } | null;
}

function DriverTypeAhead({
  label,
  value,
  drivers,
  excluded,
  on_change,
}: {
  label: string;
  value: string;
  drivers: F1Driver[];
  excluded: string[];
  on_change: (id: string) => void;
}) {
  const [query, set_query] = useState('');
  const [open, set_open] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = drivers.find(d => d.driver_id === value);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) set_open(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const available = drivers.filter(d => !excluded.includes(d.driver_id) || d.driver_id === value);
  const filtered = query
    ? available.filter(d => {
        const q = query.toLowerCase();
        return d.family_name.toLowerCase().includes(q)
          || d.given_name.toLowerCase().includes(q)
          || d.code.toLowerCase().includes(q)
          || d.constructor_name.toLowerCase().includes(q);
      })
    : available;

  return (
    <div style={{ marginBottom: '0.75rem', position: 'relative' }} ref={ref}>
      <label style={{ color: '#999', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
        {label}
      </label>
      <input
        type="text"
        value={open ? query : (selected ? `${selected.code} - ${selected.given_name} ${selected.family_name}` : '')}
        placeholder="Type driver name..."
        onChange={e => { set_query(e.target.value); set_open(true); }}
        onFocus={() => { set_open(true); set_query(''); }}
        style={{
          width: '100%',
          background: '#111111',
          color: '#e0e0e0',
          border: `1px solid ${value ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: '6px',
          padding: '0.5rem',
          fontSize: '0.9rem',
          boxSizing: 'border-box',
        }}
      />
      {value && !open && (
        <button
          onClick={() => { on_change(''); set_query(''); set_open(true); }}
          style={{
            position: 'absolute', right: '8px', top: '26px',
            background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.8rem',
          }}
        >
          x
        </button>
      )}
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#1a1a1a',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '6px',
          maxHeight: '200px',
          overflowY: 'auto',
          zIndex: 100,
          marginTop: '2px',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '0.5rem', color: '#666', fontSize: '0.85rem' }}>No matches</div>
          ) : (
            filtered.map(d => (
              <button
                key={d.driver_id}
                onClick={() => { on_change(d.driver_id); set_open(false); set_query(''); }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: d.driver_id === value ? 'rgba(225,6,0,0.15)' : 'transparent',
                  border: 'none',
                  color: '#e0e0e0',
                  padding: '0.4rem 0.5rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(225,6,0,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = d.driver_id === value ? 'rgba(225,6,0,0.15)' : 'transparent'; }}
              >
                <span style={{ color: '#e10600', fontWeight: 700, marginRight: '0.4rem' }}>{d.code}</span>
                {d.given_name} {d.family_name}
                <span style={{ color: '#666', marginLeft: '0.4rem', fontSize: '0.75rem' }}>({d.constructor_name})</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function PredictionForm({
  drivers, session_type, on_submit, on_cancel, submitting, existing_prediction,
}: PredictionFormProps) {
  const [p1, set_p1] = useState(existing_prediction?.p1 || '');
  const [p2, set_p2] = useState(existing_prediction?.p2 || '');
  const [p3, set_p3] = useState(existing_prediction?.p3 || '');
  const [fastest_lap, set_fastest_lap] = useState(existing_prediction?.fastest_lap || '');

  const is_race = session_type === 'race';
  const can_submit = p1 && p2 && p3 && (!is_race || fastest_lap);
  const selected = [p1, p2, p3].filter(Boolean);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: '10px',
      padding: '1.25rem',
      marginTop: '0.75rem',
    }}>
      <h3 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '1rem' }}>
        Predict the Podium
      </h3>

      <DriverTypeAhead label="P1 - Winner" value={p1} drivers={drivers}
        excluded={selected.filter(s => s !== p1)} on_change={set_p1} />
      <DriverTypeAhead label="P2 - Second" value={p2} drivers={drivers}
        excluded={selected.filter(s => s !== p2)} on_change={set_p2} />
      <DriverTypeAhead label="P3 - Third" value={p3} drivers={drivers}
        excluded={selected.filter(s => s !== p3)} on_change={set_p3} />

      {is_race && (
        <DriverTypeAhead label="Fastest Lap (+3 bonus)" value={fastest_lap} drivers={drivers}
          excluded={[]} on_change={set_fastest_lap} />
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
        <button
          onClick={() => on_submit(p1, p2, p3, is_race ? fastest_lap : null)}
          disabled={!can_submit || submitting}
          style={{
            flex: 1,
            background: can_submit ? '#e10600' : '#444',
            color: can_submit ? '#ffffff' : '#888',
            border: 'none',
            borderRadius: '6px',
            padding: '0.6rem',
            fontWeight: 700,
            cursor: can_submit ? 'pointer' : 'not-allowed',
            fontSize: '0.9rem',
          }}
        >
          {submitting ? 'Saving...' : 'Save Picks'}
        </button>
        <button
          onClick={on_cancel}
          style={{
            background: 'transparent',
            color: '#888',
            border: '1px solid #444',
            borderRadius: '6px',
            padding: '0.6rem 1rem',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
