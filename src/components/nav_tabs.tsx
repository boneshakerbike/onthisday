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

interface DropdownPos {
  top: number;
  left: number;
}

export default function NavTabs({ is_localhost = false, theme = 'dark' }: NavTabsProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [tools_open, set_tools_open] = useState(false);
  const [games_open, set_games_open] = useState(false);
  const [tools_pos, set_tools_pos] = useState<DropdownPos>({ top: 0, left: 0 });
  const [games_pos, set_games_pos] = useState<DropdownPos>({ top: 0, left: 0 });
  const tools_btn_ref = useRef<HTMLButtonElement>(null);
  const games_btn_ref = useRef<HTMLButtonElement>(null);
  const tools_menu_ref = useRef<HTMLDivElement>(null);
  const games_menu_ref = useRef<HTMLDivElement>(null);

  const is_light = theme === 'light';

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handle_click_outside(event: MouseEvent) {
      const target = event.target as Node;
      if (tools_open && tools_btn_ref.current && !tools_btn_ref.current.contains(target) &&
          tools_menu_ref.current && !tools_menu_ref.current.contains(target)) {
        set_tools_open(false);
      }
      if (games_open && games_btn_ref.current && !games_btn_ref.current.contains(target) &&
          games_menu_ref.current && !games_menu_ref.current.contains(target)) {
        set_games_open(false);
      }
    }

    document.addEventListener('mousedown', handle_click_outside);
    return () => document.removeEventListener('mousedown', handle_click_outside);
  }, [tools_open, games_open]);

  // Calculate dropdown position when opening
  const open_tools = () => {
    if (tools_btn_ref.current) {
      const rect = tools_btn_ref.current.getBoundingClientRect();
      set_tools_pos({ top: rect.bottom + 4, left: rect.left });
    }
    set_tools_open(!tools_open);
    set_games_open(false);
  };

  const open_games = () => {
    if (games_btn_ref.current) {
      const rect = games_btn_ref.current.getBoundingClientRect();
      set_games_pos({ top: rect.bottom + 4, left: rect.left });
    }
    set_games_open(!games_open);
    set_tools_open(false);
  };

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
    <>
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

          {/* Tools dropdown */}
          <div className="relative">
            <button
              ref={tools_btn_ref}
              onClick={open_tools}
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
          </div>

          {/* Games dropdown */}
          <div className="relative">
            <button
              ref={games_btn_ref}
              onClick={open_games}
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

    {/* Tools dropdown menu - fixed position to escape overflow */}
    {tools_open && (
      <div
        ref={tools_menu_ref}
        style={{ position: 'fixed', top: tools_pos.top, left: tools_pos.left }}
        className={`py-1 rounded-lg shadow-xl min-w-[180px] z-[9999] ${is_light ? 'bg-white border border-[#e5e0d8]' : 'bg-[#1a1a2e] border border-white/10'}`}
      >
        <Link
          href="/archive"
          onClick={() => set_tools_open(false)}
          className={`block px-4 py-2 text-sm transition-all ${is_light ? 'text-gray-600 hover:bg-[#c4704b]/10 hover:text-[#c4704b]' : 'text-gray-300 hover:bg-cyan-400/10 hover:text-cyan-400'}`}
        >
          Archive
        </Link>
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
        <Link
          href="/tools/knowledge-diff"
          onClick={() => set_tools_open(false)}
          className={`block px-4 py-2 text-sm transition-all ${is_light ? 'text-gray-600 hover:bg-[#c4704b]/10 hover:text-[#c4704b]' : 'text-gray-300 hover:bg-cyan-400/10 hover:text-cyan-400'}`}
        >
          Knowledge Diff
        </Link>
        <Link
          href="/tools/prompt-library"
          onClick={() => set_tools_open(false)}
          className={`block px-4 py-2 text-sm transition-all ${is_light ? 'text-gray-600 hover:bg-[#c4704b]/10 hover:text-[#c4704b]' : 'text-gray-300 hover:bg-cyan-400/10 hover:text-cyan-400'}`}
        >
          Prompt Library
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

    {/* Games dropdown menu - fixed position to escape overflow */}
    {games_open && (
      <div
        ref={games_menu_ref}
        style={{ position: 'fixed', top: games_pos.top, left: games_pos.left }}
        className={`py-1 rounded-lg shadow-xl min-w-[150px] z-[9999] ${is_light ? 'bg-white border border-[#e5e0d8]' : 'bg-[#1a1a2e] border border-white/10'}`}
      >
        <Link
          href="/games/frogger"
          onClick={() => set_games_open(false)}
          className={`block px-4 py-2 text-sm transition-all ${is_light ? 'text-gray-600 hover:bg-[#c4704b]/10 hover:text-[#c4704b]' : 'text-gray-300 hover:bg-cyan-400/10 hover:text-cyan-400'}`}
        >
          Frogger
        </Link>
        <Link
          href="/games/breakout"
          onClick={() => set_games_open(false)}
          className={`block px-4 py-2 text-sm transition-all ${is_light ? 'text-gray-600 hover:bg-[#c4704b]/10 hover:text-[#c4704b]' : 'text-gray-300 hover:bg-cyan-400/10 hover:text-cyan-400'}`}
        >
          Breakout
        </Link>
      </div>
    )}
    </>
  );
}
