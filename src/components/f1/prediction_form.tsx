'use client';

import { useState } from 'react';
import type { F1Driver, SessionType } from '@/lib/f1/types';

interface PredictionFormProps {
  drivers: F1Driver[];
  session_type: SessionType;
  on_submit: (p1: string, p2: string, p3: string, fastest_lap: string | null) => void;
  on_cancel: () => void;
  submitting: boolean;
}

function DriverSelect({
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
  const available = drivers.filter(d => !excluded.includes(d.driver_id) || d.driver_id === value);

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <label style={{ color: '#888', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={e => on_change(e.target.value)}
        style={{
          width: '100%',
          background: '#1a1a2e',
          color: '#e0e0e0',
          border: '1px solid rgba(0,217,255,0.3)',
          borderRadius: '6px',
          padding: '0.5rem',
          fontSize: '0.9rem',
        }}
      >
        <option value="">Select driver...</option>
        {available.map(d => (
          <option key={d.driver_id} value={d.driver_id}>
            {d.code} - {d.given_name} {d.family_name} ({d.constructor_name})
          </option>
        ))}
      </select>
    </div>
  );
}

export default function PredictionForm({
  drivers, session_type, on_submit, on_cancel, submitting,
}: PredictionFormProps) {
  const [p1, set_p1] = useState('');
  const [p2, set_p2] = useState('');
  const [p3, set_p3] = useState('');
  const [fastest_lap, set_fastest_lap] = useState('');

  const is_race = session_type === 'race';
  const can_submit = p1 && p2 && p3 && (!is_race || fastest_lap);
  const selected = [p1, p2, p3].filter(Boolean);

  return (
    <div style={{
      background: 'rgba(0,217,255,0.05)',
      border: '1px solid rgba(0,217,255,0.3)',
      borderRadius: '10px',
      padding: '1.25rem',
      marginTop: '0.75rem',
    }}>
      <h3 style={{ color: '#00d9ff', fontSize: '1rem', marginBottom: '1rem' }}>
        Predict the Podium
      </h3>

      <DriverSelect label="P1 - Winner" value={p1} drivers={drivers}
        excluded={selected.filter(s => s !== p1)} on_change={set_p1} />
      <DriverSelect label="P2 - Second" value={p2} drivers={drivers}
        excluded={selected.filter(s => s !== p2)} on_change={set_p2} />
      <DriverSelect label="P3 - Third" value={p3} drivers={drivers}
        excluded={selected.filter(s => s !== p3)} on_change={set_p3} />

      {is_race && (
        <DriverSelect label="Fastest Lap (+3 bonus)" value={fastest_lap} drivers={drivers}
          excluded={[]} on_change={set_fastest_lap} />
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
        <button
          onClick={() => on_submit(p1, p2, p3, is_race ? fastest_lap : null)}
          disabled={!can_submit || submitting}
          style={{
            flex: 1,
            background: can_submit ? '#00d9ff' : '#444',
            color: can_submit ? '#1a1a2e' : '#888',
            border: 'none',
            borderRadius: '6px',
            padding: '0.6rem',
            fontWeight: 700,
            cursor: can_submit ? 'pointer' : 'not-allowed',
            fontSize: '0.9rem',
          }}
        >
          {submitting ? 'Submitting...' : 'Lock In Prediction'}
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
