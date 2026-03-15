'use client';

import { useEffect, useRef } from 'react';

interface AnthemPlayerProps {
  player_name: string;
  anthem_url: string;
  on_dismiss: () => void;
}

export default function AnthemPlayer({ player_name, anthem_url, on_dismiss }: AnthemPlayerProps) {
  const video_ref = useRef<HTMLVideoElement>(null);

  // Attempt autoplay on mount; browsers may block it on mobile — controls attr provides fallback
  useEffect(() => {
    video_ref.current?.play().catch(() => {});
  }, []);

  // ESC to dismiss
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') on_dismiss(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [on_dismiss]);

  return (
    <div
      onClick={on_dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a1a1a',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '1.5rem',
          maxWidth: '500px',
          width: '90%',
          textAlign: 'center',
        }}
      >
        <div style={{
          color: '#e10600',
          fontSize: '0.7rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginBottom: '0.4rem',
        }}>
          Round Winner
        </div>
        <div style={{
          color: '#ffffff',
          fontSize: '1.3rem',
          fontWeight: 700,
          marginBottom: '1rem',
        }}>
          {player_name}
        </div>
        <video
          ref={video_ref}
          src={anthem_url}
          controls
          playsInline
          onEnded={on_dismiss}
          style={{
            width: '100%',
            borderRadius: '8px',
            background: '#000',
            display: 'block',
            marginBottom: '1rem',
          }}
        />
        <button
          onClick={on_dismiss}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#d1d5db',
            borderRadius: '6px',
            padding: '0.4rem 1.25rem',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
