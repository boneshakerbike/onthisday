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
}

export default function NavTabs({ is_localhost = false }: NavTabsProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [tools_open, set_tools_open] = useState(false);
  const dropdown_ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handle_click_outside(event: MouseEvent) {
      if (dropdown_ref.current && !dropdown_ref.current.contains(event.target as Node)) {
        set_tools_open(false);
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
    const base = 'px-4 py-2 text-sm font-medium transition-all border-b-2';
    if (is_active(path)) {
      return `${base} text-cyan-400 border-cyan-400`;
    }
    return `${base} text-gray-400 border-transparent hover:text-cyan-400 hover:border-cyan-400/50`;
  };

  return (
    <header className="mb-6 border-b border-white/10">
      <div className="flex items-center justify-between">
        {/* Left: Navigation tabs */}
        <nav className="flex items-center gap-1">
          {/* Dev Home - only on localhost */}
          {is_localhost && (
            <a
              href="http://localhost:8080"
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-cyan-400 transition-all border-b-2 border-transparent"
            >
              Dev Home
            </a>
          )}

          {/* On This Day */}
          <Link href="/" className={tab_class('/')}>
            On This Day
          </Link>

          {/* Stories */}
          <Link href="/stories" className={tab_class('/stories')}>
            Stories
          </Link>

          {/* Tools dropdown */}
          <div className="relative" ref={dropdown_ref}>
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
              <div className="absolute top-full left-0 mt-1 py-1 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl min-w-[180px] z-50">
                <Link
                  href="/tools/markdown"
                  onClick={() => set_tools_open(false)}
                  className="block px-4 py-2 text-sm text-gray-300 hover:bg-cyan-400/10 hover:text-cyan-400 transition-all"
                >
                  Markdown Converter
                </Link>
                <Link
                  href="/tools/suggestions"
                  onClick={() => set_tools_open(false)}
                  className="block px-4 py-2 text-sm text-gray-300 hover:bg-cyan-400/10 hover:text-cyan-400 transition-all"
                >
                  Suggestions
                </Link>
                <div className="border-t border-white/10 my-1"></div>
                <Link
                  href="/tools/admin"
                  onClick={() => set_tools_open(false)}
                  className="block px-4 py-2 text-sm text-gray-300 hover:bg-cyan-400/10 hover:text-cyan-400 transition-all"
                >
                  Admin Reference
                </Link>
              </div>
            )}
          </div>

          {/* Visit Substack - external link */}
          <a
            href="https://8i11.substack.com/publish/posts/drafts"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-cyan-400 transition-all border-b-2 border-transparent"
          >
            Drafts ↗
          </a>
        </nav>

        {/* Right: User info */}
        {session && (
          <div className="text-xs text-gray-500 pr-1">
            {session.user?.name || session.user?.email || 'Guest'}
            <button
              onClick={() => signOut()}
              className="ml-2 text-gray-500 hover:text-cyan-400 underline"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
