/**
 * NavTabs - Main navigation header
 * Tabs: Home | Creative | Tools | Health | Games
 * Tools dropdown sourced from src/lib/tools.ts
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { TOOLS } from '@/lib/tools';

interface NavTabsProps {
  theme?: 'dark' | 'light';
}

interface DropdownPos {
  top: number;
  left: number;
}

export default function NavTabs({ theme = 'dark' }: NavTabsProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [creative_open, set_creative_open] = useState(false);
  const [tools_open, set_tools_open] = useState(false);
  const [health_open, set_health_open] = useState(false);
  const [games_open, set_games_open] = useState(false);
  const [creative_pos, set_creative_pos] = useState<DropdownPos>({ top: 0, left: 0 });
  const [tools_pos, set_tools_pos] = useState<DropdownPos>({ top: 0, left: 0 });
  const [health_pos, set_health_pos] = useState<DropdownPos>({ top: 0, left: 0 });
  const [games_pos, set_games_pos] = useState<DropdownPos>({ top: 0, left: 0 });
  const nav_ref = useRef<HTMLElement>(null);
  const [can_scroll_left, set_can_scroll_left] = useState(false);
  const [can_scroll_right, set_can_scroll_right] = useState(false);
  const creative_btn_ref = useRef<HTMLButtonElement>(null);
  const tools_btn_ref = useRef<HTMLButtonElement>(null);
  const health_btn_ref = useRef<HTMLButtonElement>(null);
  const games_btn_ref = useRef<HTMLButtonElement>(null);
  const creative_menu_ref = useRef<HTMLDivElement>(null);
  const tools_menu_ref = useRef<HTMLDivElement>(null);
  const health_menu_ref = useRef<HTMLDivElement>(null);
  const games_menu_ref = useRef<HTMLDivElement>(null);

  const [is_local, set_is_local] = useState(false);
  useEffect(() => { set_is_local(window.location.hostname === 'localhost'); }, []);

  const is_light = theme === 'light';

  // Track nav scroll position for fade indicators
  useEffect(() => {
    const nav = nav_ref.current;
    if (!nav) return;
    const check_scroll = () => {
      set_can_scroll_left(nav.scrollLeft > 0);
      set_can_scroll_right(nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1);
    };
    check_scroll();
    nav.addEventListener('scroll', check_scroll);
    const observer = new ResizeObserver(check_scroll);
    observer.observe(nav);
    return () => {
      nav.removeEventListener('scroll', check_scroll);
      observer.disconnect();
    };
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handle_click_outside(event: MouseEvent) {
      const target = event.target as Node;
      if (creative_open && creative_btn_ref.current && !creative_btn_ref.current.contains(target) &&
          creative_menu_ref.current && !creative_menu_ref.current.contains(target)) {
        set_creative_open(false);
      }
      if (tools_open && tools_btn_ref.current && !tools_btn_ref.current.contains(target) &&
          tools_menu_ref.current && !tools_menu_ref.current.contains(target)) {
        set_tools_open(false);
      }
      if (health_open && health_btn_ref.current && !health_btn_ref.current.contains(target) &&
          health_menu_ref.current && !health_menu_ref.current.contains(target)) {
        set_health_open(false);
      }
      if (games_open && games_btn_ref.current && !games_btn_ref.current.contains(target) &&
          games_menu_ref.current && !games_menu_ref.current.contains(target)) {
        set_games_open(false);
      }
    }

    document.addEventListener('mousedown', handle_click_outside);
    return () => document.removeEventListener('mousedown', handle_click_outside);
  }, [creative_open, tools_open, health_open, games_open]);

  const close_all = () => {
    set_creative_open(false);
    set_tools_open(false);
    set_health_open(false);
    set_games_open(false);
  };

  const open_dropdown = (name: string) => {
    const refs: Record<string, React.RefObject<HTMLButtonElement | null>> = {
      creative: creative_btn_ref, tools: tools_btn_ref, health: health_btn_ref, games: games_btn_ref
    };
    const setters: Record<string, (v: DropdownPos) => void> = {
      creative: set_creative_pos, tools: set_tools_pos, health: set_health_pos, games: set_games_pos
    };
    const toggles: Record<string, [boolean, (v: boolean) => void]> = {
      creative: [creative_open, set_creative_open],
      tools: [tools_open, set_tools_open],
      health: [health_open, set_health_open],
      games: [games_open, set_games_open],
    };

    const ref = refs[name];
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setters[name]({ top: rect.bottom + 4, left: rect.left });
    }

    const [is_open, set_open] = toggles[name];
    close_all();
    if (!is_open) set_open(true);
  };

  const is_active = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const tab_class = (path: string) => {
    const base = 'px-4 sm:px-3 py-3 sm:py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0 font-medium transition-all border-b-2 whitespace-nowrap';
    if (is_active(path)) {
      return `${base} ${is_light ? 'text-[#c4704b] border-[#c4704b]' : 'text-cyan-400 border-cyan-400'}`;
    }
    return `${base} ${is_light ? 'text-gray-500 border-transparent hover:text-[#c4704b] hover:border-[#c4704b]/50' : 'text-gray-200 border-transparent hover:text-cyan-400 hover:border-cyan-400/50'}`;
  };

  const inactive_class = `px-4 sm:px-3 py-3 sm:py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0 font-medium transition-all border-b-2 border-transparent whitespace-nowrap ${is_light ? 'text-gray-400 hover:text-[#c4704b]' : 'text-gray-200 hover:text-cyan-400'}`;

  const dropdown_class = `py-1 rounded-lg shadow-xl min-w-[180px] z-[9999] ${is_light ? 'bg-white border border-[#e5e0d8]' : 'bg-[#1a1a2e] border border-white/10'}`;

  const dropdown_item_class = `block px-4 py-3 sm:py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0 transition-all ${is_light ? 'text-gray-600 hover:bg-[#c4704b]/10 hover:text-[#c4704b]' : 'text-gray-200 hover:bg-cyan-400/10 hover:text-cyan-400'}`;

  const chevron = (is_open: boolean) => (
    <svg
      className={`w-4 h-4 transition-transform ${is_open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  return (
    <>
    <header className={`mb-6 border-b ${is_light ? 'border-[#e5e0d8]' : 'border-white/10'}`}>
      <div className="flex items-center justify-between">
        {/* Left: Navigation tabs - scrollable on mobile */}
        <div className="relative flex-1 min-w-0">
        {can_scroll_left && (
          <div className={`absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none bg-gradient-to-r ${is_light ? 'from-[#faf8f5]' : 'from-[#1a1a2e]'} to-transparent`} />
        )}
        {can_scroll_right && (
          <div className={`absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none bg-gradient-to-l ${is_light ? 'from-[#faf8f5]' : 'from-[#1a1a2e]'} to-transparent`} />
        )}
        <nav ref={nav_ref} className="flex items-center overflow-x-auto scrollbar-hide">
          {/* Home */}
          <Link href="/" className={tab_class('/')}>
            Home
          </Link>

          {/* Creative dropdown */}
          <div className="relative">
            <button
              ref={creative_btn_ref}
              onClick={() => open_dropdown('creative')}
              className={`${tab_class('/creative')} flex items-center gap-1`}
            >
              Creative
              {chevron(creative_open)}
            </button>
          </div>

          {/* Tools dropdown */}
          <div className="relative">
            <button
              ref={tools_btn_ref}
              onClick={() => open_dropdown('tools')}
              className={`${tab_class('/tools')} flex items-center gap-1`}
            >
              Tools
              {chevron(tools_open)}
            </button>
          </div>

          {/* Health dropdown */}
          <div className="relative">
            <button
              ref={health_btn_ref}
              onClick={() => open_dropdown('health')}
              className={`${tab_class('/health')} flex items-center gap-1`}
            >
              Health
              {chevron(health_open)}
            </button>
          </div>

          {/* Games dropdown */}
          <div className="relative">
            <button
              ref={games_btn_ref}
              onClick={() => open_dropdown('games')}
              className={`${tab_class('/games')} flex items-center gap-1`}
            >
              Games
              {chevron(games_open)}
            </button>
          </div>

        </nav>
        </div>

        {/* Right: User info */}
        <div className="flex items-center whitespace-nowrap ml-4">
          {is_local && (
            <a
              href="http://localhost:8080"
              className={`text-xs mr-3 ${is_light ? 'text-gray-400 hover:text-[#c4704b]' : 'text-gray-500 hover:text-cyan-400'}`}
            >
              Dev Hub
            </a>
          )}
          {session && (
            <div className={`text-xs pr-1 ${is_light ? 'text-gray-500' : 'text-gray-400'}`}>
              <span className="hidden sm:inline">{session.user?.name || session.user?.email || 'Guest'}</span>
              <button
                onClick={() => signOut()}
                className={`ml-2 underline ${is_light ? 'text-gray-500 hover:text-[#c4704b]' : 'text-gray-400 hover:text-cyan-400'}`}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

    {/* Creative dropdown menu */}
    {creative_open && (
      <div
        ref={creative_menu_ref}
        style={{ position: 'fixed', top: creative_pos.top, left: creative_pos.left }}
        className={dropdown_class}
      >
        <Link
          href="/creative"
          onClick={() => set_creative_open(false)}
          className={dropdown_item_class}
        >
          On This Day
        </Link>
        <Link
          href="/creative/archive"
          onClick={() => set_creative_open(false)}
          className={dropdown_item_class}
        >
          Archive
        </Link>
      </div>
    )}

    {/* Tools dropdown menu — items sourced from src/lib/tools.ts */}
    {tools_open && (
      <div
        ref={tools_menu_ref}
        style={{ position: 'fixed', top: tools_pos.top, left: tools_pos.left }}
        className={dropdown_class}
      >
        {TOOLS.map((tool) => (
          <Link
            key={tool.path}
            href={tool.path}
            onClick={() => set_tools_open(false)}
            className={dropdown_item_class}
          >
            {tool.label}
          </Link>
        ))}
      </div>
    )}

    {/* Health dropdown menu */}
    {health_open && (
      <div
        ref={health_menu_ref}
        style={{ position: 'fixed', top: health_pos.top, left: health_pos.left }}
        className={dropdown_class}
      >
        <Link
          href="/health/wellness"
          onClick={() => set_health_open(false)}
          className={dropdown_item_class}
        >
          Wellness
        </Link>
      </div>
    )}

    {/* Games dropdown menu */}
    {games_open && (
      <div
        ref={games_menu_ref}
        style={{ position: 'fixed', top: games_pos.top, left: games_pos.left }}
        className={`${dropdown_class} min-w-[150px]`}
      >
        <Link
          href="/games/frogger"
          onClick={() => set_games_open(false)}
          className={dropdown_item_class}
        >
          Frogger
        </Link>
        <Link
          href="/games/breakout"
          onClick={() => set_games_open(false)}
          className={dropdown_item_class}
        >
          Breakout
        </Link>
        <Link
          href="/games/f1"
          onClick={() => set_games_open(false)}
          className={dropdown_item_class}
        >
          F1 Predictions
        </Link>
      </div>
    )}
    </>
  );
}
