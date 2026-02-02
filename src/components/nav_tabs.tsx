/**
 * NavTabs - Main navigation header
 * Single line: Tabs left/center, user info right
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

interface NavTabsProps {
  is_localhost?: boolean;
  theme?: 'dark' | 'light';
}

export default function NavTabs({ is_localhost = false, theme = 'dark' }: NavTabsProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [tools_open, set_tools_open] = useState(false);
  const [games_open, set_games_open] = useState(false);
  const tools_ref = useRef<HTMLDivElement>(null);
  const games_ref = useRef<HTMLDivElement>(null);

  const is_light = theme === 'light';

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handle_click_outside(event: MouseEvent) {
      if (tools_ref.current && !tools_ref.current.contains(event.target as Node)) {
        set_tools_open(false);
      }
      if (games_ref.current && !games_ref.current.contains(event.target as Node)) {
        set_games_open(false);
      }
    }

    document.addEventListener('mousedown', handle_click_outside);
    return () => document.removeEventListener('mousedown', handle_click_outside);
  }, []);

  const is_active = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const tab_class = (path: string) => {
    const base = 'px-3 py-2 text-sm font-medium transition-all border-b-2 whitespace-nowrap';
    if (is_active(path)) {
      return `${base} ${is_light ? 'text-[#c4704b] border-[#c4704b]' : 'text-cyan-400 border-cyan-400'}`;
    }
    return `${base} ${is_light ? 'text-gray-500 border-transparent hover:text-[#c4704b] hover:border-[#c4704b]/50' : 'text-gray-400 border-transparent hover:text-cyan-400 hover:border-cyan-400/50'}`;
  };

  const inactive_class = `px-3 py-2 text-sm font-medium transition-all border-b-2 border-transparent whitespace-nowrap ${is_light ? 'text-gray-400 hover:text-[#c4704b]' : 'text-gray-500 hover:text-cyan-400'}`;

  return (
    <header className={`mb-6 border-b ${is_light ? 'border-[#e5e0d8]' : 'border-white/10'}`}>
      <div className="flex items-center justify-between">
        {/* Left: Navigation tabs - scrollable on mobile */}
        <nav className="flex items-center overflow-x-auto">
          {/* Dev Home - only on localhost */}
          {is_localhost && (
            <a
              href="http://localhost:8080"
              className={inactive_class}
            >
              Dev
            </a>
          )}

          {/* On This Day */}
          <Link href="/" className={tab_class('/')}>
            On This Day
          </Link>

          {/* Archive (stories) - hide when on archive page */}
          {!pathname.startsWith('/archive') && (
            <Link href="/archive" className={tab_class('/archive')}>
              Archive
            </Link>
          )}

          {/* Tools dropdown */}
          <div className="relative" ref={tools_ref}>
            <button
              onClick={() => set_tools_open(!tools_open)}
              className={`${tab_class('/tools')} flex items-center gap-1`}
            >
              Tools
              <svg
                className={`w-4 h-4 transition-transform ${tools_open ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {tools_open && (
              <div className={`absolute top-full left-0 mt-1 py-1 rounded-lg shadow-xl min-w-[180px] z-50 ${is_light ? 'bg-white border border-[#e5e0d8]' : 'bg-[#1a1a2e] border border-white/10'}`}>
                <Link
                  href="/tools/markdown"
                  onClick={() => set_tools_open(false)}
                  className={`block px-4 py-2 text-sm transition-all ${is_light ? 'text-gray-600 hover:bg-[#c4704b]/10 hover:text-[#c4704b]' : 'text-gray-300 hover:bg-cyan-400/10 hover:text-cyan-400'}`}
                >
                  Markdown Converter
                </Link>
                <Link
                  href="/tools/suggestions"
                  onClick={() => set_tools_open(false)}
                  className={`block px-4 py-2 text-sm transition-all ${is_light ? 'text-gray-600 hover:bg-[#c4704b]/10 hover:text-[#c4704b]' : 'text-gray-300 hover:bg-cyan-400/10 hover:text-cyan-400'}`}
                >
                  Suggestions
                </Link>
                <div className={`border-t my-1 ${is_light ? 'border-[#e5e0d8]' : 'border-white/10'}`}></div>
                <Link
                  href="/tools/admin"
                  onClick={() => set_tools_open(false)}
                  className={`block px-4 py-2 text-sm transition-all ${is_light ? 'text-gray-600 hover:bg-[#c4704b]/10 hover:text-[#c4704b]' : 'text-gray-300 hover:bg-cyan-400/10 hover:text-cyan-400'}`}
                >
                  Admin Reference
                </Link>
              </div>
            )}
          </div>

          {/* Games dropdown */}
          <div className="relative" ref={games_ref}>
            <button
              onClick={() => set_games_open(!games_open)}
              className={`${tab_class('/games')} flex items-center gap-1`}
            >
              Games
              <svg
                className={`w-4 h-4 transition-transform ${games_open ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {games_open && (
              <div className={`absolute top-full left-0 mt-1 py-1 rounded-lg shadow-xl min-w-[150px] z-50 ${is_light ? 'bg-white border border-[#e5e0d8]' : 'bg-[#1a1a2e] border border-white/10'}`}>
                <Link
                  href="/games/frogger"
                  onClick={() => set_games_open(false)}
                  className={`block px-4 py-2 text-sm transition-all ${is_light ? 'text-gray-600 hover:bg-[#c4704b]/10 hover:text-[#c4704b]' : 'text-gray-300 hover:bg-cyan-400/10 hover:text-cyan-400'}`}
                >
                  Frogger
                </Link>
              </div>
            )}
          </div>

          {/* Visit Substack - external link */}
          <a
            href="https://8i11.substack.com/publish/posts/drafts"
            target="_blank"
            rel="noopener noreferrer"
            className={inactive_class}
          >
            Drafts ↗
          </a>
        </nav>

        {/* Right: User info */}
        {session && (
          <div className={`text-xs pr-1 whitespace-nowrap ml-4 ${is_light ? 'text-gray-500' : 'text-gray-500'}`}>
            <span className="hidden sm:inline">{session.user?.name || session.user?.email || 'Guest'}</span>
            <button
              onClick={() => signOut()}
              className={`ml-2 underline ${is_light ? 'text-gray-500 hover:text-[#c4704b]' : 'text-gray-500 hover:text-cyan-400'}`}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
