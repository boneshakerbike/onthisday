/**
 * Shared per-section accent colors (exact hex) — single source of truth for the
 * accents used by the mobile nav drawer (src/components/nav_tabs.tsx) and the
 * home-page section cards (src/app/page.tsx). Keeps the two surfaces from drifting
 * (previously page.tsx used Tailwind purple-400/green-400 which don't match the
 * design hexes #a78bfa / #34d399).
 *
 * Dark theme only. Light theme uses the single terracotta accent (#c4704b);
 * per-section color is a dark-theme-only feature.
 */
export const SECTION_ACCENTS: Record<string, string> = {
  Creative: '#22d3ee',
  Tools: '#a78bfa',
  Health: '#34d399',
  Games: '#f472b6',
  Weather: '#fbbf24',
};

/** Wordmark / brand accent (dark theme). Light theme uses terracotta #c4704b. */
export const BRAND_ACCENT = '#22d3ee';
