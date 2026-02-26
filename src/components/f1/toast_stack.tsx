/**
 * F1 Toast Stack — brief notifications for group activity
 * Bottom-right corner, auto-dismissed by parent after 4s, max 3 stacked.
 */

'use client';

export interface ToastItem {
  id: number;
  message: string;
}

interface ToastStackProps {
  toasts: ToastItem[];
  on_dismiss: (id: number) => void;
}

export default function ToastStack({ toasts, on_dismiss }: ToastStackProps) {
  if (toasts.length === 0) return null;
  return (
    <>
      <style>{`
        @keyframes f1-toast-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '0.5rem',
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div
            key={t.id}
            onClick={() => on_dismiss(t.id)}
            style={{
              background: '#1e1e28',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#e0e0e0',
              borderRadius: '8px',
              padding: '0.6rem 0.9rem',
              fontSize: '0.8rem',
              maxWidth: '260px',
              lineHeight: 1.4,
              pointerEvents: 'auto',
              cursor: 'pointer',
              animation: 'f1-toast-in 0.2s ease',
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}
