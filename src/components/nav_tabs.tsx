/**
 * NavTabs - Main navigation header
 * Tabs: Home | Creative | Tools | Health | Games
 * Tools dropdown sourced from src/lib/tools.ts
 * Dropdowns use Radix UI for collision-safe positioning and accessibility.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { TOOLS } from '@/lib/tools';

interface NavTabsProps {
  theme?: 'dark' | 'light';
}

export default function NavTabs({ theme = 'dark' }: NavTabsProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const nav_ref = useRef<HTMLElement>(null);
  const has_peeked = useRef(false);
  const [can_scroll_left, set_can_scroll_left] = useState(false);
  const [can_scroll_right, set_can_scroll_right] = useState(false);
  const [is_local, set_is_local] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe: window only accessible client-side
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

  // Scroll-peek animation on mount
  useEffect(() => {
    const nav = nav_ref.current;
    if (!nav || has_peeked.current) return;
    let t2: ReturnType<typeof setTimeout>;
    const t1 = setTimeout(() => {
      if (nav.scrollWidth <= nav.clientWidth) return;
      has_peeked.current = true;
      nav.scrollTo({ left: 48 });
      t2 = setTimeout(() => {
        nav.scrollTo({ left: 0, behavior: 'smooth' });
      }, 600);
    }, 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);


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

  const content_class = `rounded-lg shadow-xl min-w-[180px] py-1 z-[9999] ${is_light ? 'bg-white border border-[#e5e0d8]' : 'bg-[#1a1a2e] border border-white/10'}`;

  const item_class = `block px-4 py-3 sm:py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0 transition-all cursor-pointer outline-none ${is_light ? 'text-gray-600 hover:bg-[#c4704b]/10 hover:text-[#c4704b] focus:bg-[#c4704b]/10 focus:text-[#c4704b]' : 'text-gray-200 hover:bg-cyan-400/10 hover:text-cyan-400 focus:bg-cyan-400/10 focus:text-cyan-400'}`;

  // Chevron rotates via group-data-[state=open] — Radix sets data-state on the Trigger
  const chevron_svg = (
    <svg
      className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  const trigger_class = (path: string) =>
    `group bg-transparent outline-none focus:outline-none focus-visible:outline-none ${tab_class(path)} flex items-center gap-1`;

  return (
    <header className={`mb-6 border-b ${is_light ? 'border-[#e5e0d8]' : 'border-white/10'}`}>
      <div className="flex items-center justify-between">
        {/* Left: Navigation tabs - scrollable on mobile */}
        <div className="relative flex-1 min-w-0">
          {can_scroll_left && (
            <button
              onClick={() => nav_ref.current?.scrollBy({ left: -120, behavior: 'smooth' })}
              className={`absolute left-0 top-0 bottom-0 w-8 z-20 flex items-center justify-center font-bold text-lg ${is_light ? 'text-[#c4704b]' : 'text-cyan-400'}`}
              aria-label="Scroll navigation left"
            >
              ‹
            </button>
          )}
          {can_scroll_left && (
            <div className={`absolute left-8 top-0 bottom-0 w-8 z-10 pointer-events-none bg-gradient-to-r ${is_light ? 'from-[#faf8f5]' : 'from-[#1a1a2e]'} to-transparent`} />
          )}
          {can_scroll_right && (
            <div className={`absolute right-8 top-0 bottom-0 w-8 z-10 pointer-events-none bg-gradient-to-l ${is_light ? 'from-[#faf8f5]' : 'from-[#1a1a2e]'} to-transparent`} />
          )}
          {can_scroll_right && (
            <button
              onClick={() => nav_ref.current?.scrollBy({ left: 120, behavior: 'smooth' })}
              className={`absolute right-0 top-0 bottom-0 w-8 z-20 flex items-center justify-center font-bold text-lg animate-pulse ${is_light ? 'text-[#c4704b]' : 'text-cyan-400'}`}
              aria-label="Scroll navigation right"
            >
              ›
            </button>
          )}
          <nav ref={nav_ref} className="flex items-center overflow-x-auto scrollbar-hide pr-8">
            {/* Home */}
            <Link href="/" className={tab_class('/')}>
              Home
            </Link>

            {/* Creative dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className={trigger_class('/creative')}>
                  Creative {chevron_svg}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className={content_class}
                  sideOffset={4}
                  align="start"
                  avoidCollisions
                >
                  <DropdownMenu.Item asChild>
                    <Link href="/creative" className={item_class}>On This Day</Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild>
                    <Link href="/creative/archive" className={item_class}>Archive</Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild>
                    <Link href="/creative/text-cleaner" className={item_class}>What Am I Trying To Say</Link>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Tools dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className={trigger_class('/tools')}>
                  Tools {chevron_svg}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className={content_class}
                  sideOffset={4}
                  align="start"
                  avoidCollisions
                >
                  {TOOLS.map((tool) => (
                    <DropdownMenu.Item key={tool.path} asChild>
                      <Link href={tool.path} className={item_class}>{tool.label}</Link>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Health dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className={trigger_class('/health')}>
                  Health {chevron_svg}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className={content_class}
                  sideOffset={4}
                  align="start"
                  avoidCollisions
                >
                  <DropdownMenu.Item asChild>
                    <Link href="/health/oura" className={item_class}>Oura</Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild>
                    <Link href="/health/strava" className={item_class}>Strava</Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild>
                    <Link href="/health/coros" className={item_class}>COROS</Link>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Games dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className={trigger_class('/games')}>
                  Games {chevron_svg}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className={`${content_class} min-w-[150px]`}
                  sideOffset={4}
                  align="start"
                  avoidCollisions
                >
                  <DropdownMenu.Item asChild>
                    <Link href="/games/frogger" className={item_class}>Frogger</Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild>
                    <Link href="/games/breakout" className={item_class}>Breakout</Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild>
                    <Link href="/games/f1" className={item_class}>F1 Predictions</Link>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Weather (standalone link) */}
            <Link href="/weather" className={tab_class('/weather')}>
              Weather
            </Link>
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
  );
}
