/**
 * F1 Activity HUD — persistent collapsible feed of group actions
 * Desktop: 260px panel fixed bottom-right. Mobile: full-width at bottom.
 * Collapsed by default on mobile, expanded on desktop.
 */

'use client';

import { useState, useEffect } from 'react';

export interface ActivityEntry {
  id: number;
  ts: number;          // Date.now() at creation (0 for status entries)
  player_name: string;
  text: string;        // pre-formatted action description
  status?: boolean;    // true = catch-up summary on load, not a live action
}

interface ActivityHudProps {
  entries: ActivityEntry[];
}

function relative_time(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 30) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function ActivityHud({ entries }: ActivityHudProps) {
  const [expanded, set_expanded] = useState(false);
  const [tick, set_tick] = useState(0);
  void tick;

  // Default expanded on desktop, collapsed on mobile
  useEffect(() => {
    if (window.innerWidth >= 640) set_expanded(true);
  }, []);

  // Refresh timestamps every 30s
  useEffect(() => {
    const t = setInterval(() => set_tick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <style>{`
        .f1-hud-wrap {
          position: fixed;
          bottom: 0;
          right: 1rem;
          width: 260px;
          z-index: 1500;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        @media (max-width: 639px) {
          .f1-hud-wrap {
            right: 0;
            left: 0;
            width: 100%;
          }
        }
      `}</style>
      <div className="f1-hud-wrap">
        {/* Header — always visible */}
        <div
          onClick={() => set_expanded(e => !e)}
          style={{
            background: '#1e1e28',
            border: '1px solid rgba(255,255,255,0.12)',
            borderBottom: expanded ? 'none' : '1px solid rgba(255,255,255,0.12)',
            borderRadius: expanded ? '8px 8px 0 0' : '8px 8px 0 0',
            padding: '0.45rem 0.75rem',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ color: '#e10600', fontSize: '0.6rem' }}>●</span>
            <span style={{ color: '#999', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Live Activity
            </span>
            {entries.length > 0 && (
              <span style={{ color: '#555', fontSize: '0.65rem' }}>({entries.length})</span>
            )}
          </div>
          <span style={{ color: '#555', fontSize: '0.65rem' }}>{expanded ? '▼' : '▲'}</span>
        </div>

        {/* Feed */}
        {expanded && (
          <div style={{
            background: '#15151e',
            border: '1px solid rgba(255,255,255,0.08)',
            borderTop: 'none',
            borderRadius: '0 0 0 0',
            maxHeight: '240px',
            overflowY: 'auto',
          }}>
            {entries.length === 0 ? (
              <div style={{ color: '#444', fontSize: '0.72rem', padding: '0.75rem', textAlign: 'center' }}>
                No activity yet — waiting for picks
              </div>
            ) : (
              entries.map(e => (
                <div key={e.id} style={{
                  padding: '0.45rem 0.75rem',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  fontSize: '0.72rem',
                  lineHeight: 1.4,
                  opacity: e.status ? 0.5 : 1,
                }}>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{e.player_name}</span>
                  {' '}
                  <span style={{ color: '#999' }}>{e.text}</span>
                  {!e.status && (
                    <div style={{ color: '#444', fontSize: '0.62rem', marginTop: '0.1rem' }}>
                      {relative_time(e.ts)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}
