/**
 * F1 Player Picker — full-screen overlay for claiming a roster identity
 */

'use client';

interface PlayerPickerProps {
  roster: string[];
  on_claim: (name: string) => void;
}

export default function PlayerPicker({ roster, on_claim }: PlayerPickerProps) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.85)',
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#1e1e28',
        border: '1px solid rgba(225,6,0,0.4)',
        borderRadius: '12px',
        padding: '2rem',
        textAlign: 'center',
        maxWidth: '320px',
        width: '90%',
      }}>
        <div style={{ color: '#e10600', fontSize: '1.1rem', fontWeight: 700 }}>
          Who are you?
        </div>

        {roster.length > 0 ? (
          <>
            <div style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              Pick your name from the roster
            </div>
            <div style={{ margin: '1rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {roster.map(name => (
                <button
                  key={name}
                  onClick={() => on_claim(name)}
                  style={{
                    background: 'rgba(225,6,0,0.1)',
                    border: '1px solid rgba(225,6,0,0.3)',
                    color: '#e0e0e0',
                    borderRadius: '6px',
                    padding: '0.6rem',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            <div style={{ color: '#555', fontSize: '0.75rem' }}>
              Don&apos;t see your name? Ask the admin to add you to the roster, then refresh.
            </div>
          </>
        ) : (
          <div style={{ color: '#888', fontSize: '0.85rem', marginTop: '1rem', lineHeight: 1.5 }}>
            No players on the roster yet.<br />
            Ask the admin to add you, then refresh.
          </div>
        )}
      </div>
    </div>
  );
}
