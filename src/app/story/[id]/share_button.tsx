/**
 * Share button component for story pages
 * Supports native share (mobile) and copy to clipboard (desktop)
 */

'use client';

import { useState } from 'react';

interface ShareButtonProps {
  storyId: string;
}

export default function ShareButton({ storyId }: ShareButtonProps) {
  const [copied, set_copied] = useState(false);

  const share_url = typeof window !== 'undefined'
    ? `${window.location.origin}/story/${storyId}`
    : `https://onthisday-xi.vercel.app/story/${storyId}`;

  const handle_share = async () => {
    // Try native share first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: document.title,
          url: share_url,
        });
        return;
      } catch {
        // User cancelled or share failed, fall through to copy
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(share_url);
      set_copied(true);
      setTimeout(() => set_copied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = share_url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      set_copied(true);
      setTimeout(() => set_copied(false), 2000);
    }
  };

  return (
    <button
      onClick={handle_share}
      style={{
        marginTop: '24px',
        padding: '12px 24px',
        background: copied ? '#4a9c6d' : '#c4704b',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '0.95em',
        fontWeight: 500,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'background 0.2s ease',
      }}
      onMouseOver={(e) => !copied && (e.currentTarget.style.background = '#b5613d')}
      onMouseOut={(e) => !copied && (e.currentTarget.style.background = '#c4704b')}
    >
      {copied ? (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Link Copied
        </>
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
            <polyline points="16 6 12 2 8 6"></polyline>
            <line x1="12" y1="2" x2="12" y2="15"></line>
          </svg>
          Share
        </>
      )}
    </button>
  );
}
