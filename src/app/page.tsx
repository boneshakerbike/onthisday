/**
 * Landing page - Dashboard with category cards and mini links
 * Route: /
 */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import NavTabs from '@/components/nav_tabs';

interface MiniLink {
  label: string;
  href: string;
  external?: boolean;
}

interface Category {
  title: string;
  description: string;
  icon: string;
  color: string;
  links: MiniLink[];
}

export default function HomePage() {
  useEffect(() => { document.title = '8i11 | Home'; }, []);

  const categories: Category[] = [
    {
      title: 'Creative',
      description: 'Browse Substack posts by date, generate reflective stories',
      icon: '✍️',
      color: 'cyan',
      links: [
        { label: 'On This Day', href: '/creative' },
        { label: 'Archive', href: '/creative/archive' },
      ],
    },
    {
      title: 'Tools',
      description: 'Utilities for writing, thinking, and building',
      icon: '🛠️',
      color: 'purple',
      links: [
        { label: 'Chipboard', href: '/tools/chipboard' },
        { label: 'Markdown', href: '/tools/markdown' },
        { label: 'Knowledge Diff', href: '/tools/knowledge-diff' },
        { label: 'Prompt Library', href: '/tools/prompt-library' },
        { label: 'Admin', href: '/tools/admin' },
      ],
    },
    {
      title: 'Health',
      description: 'Oura Ring daily scores — sleep, readiness, activity',
      icon: '🚴',
      color: 'green',
      links: [
        { label: 'Wellness', href: '/health/wellness' },
      ],
    },
    {
      title: 'Games',
      description: 'Pixel art classics and brick breakers',
      icon: '🎮',
      color: 'pink',
      links: [
        { label: 'Frogger', href: '/games/frogger' },
        { label: 'Breakout', href: '/games/breakout' },
      ],
    },
  ];

  const color_map: Record<string, { border: string; hover_bg: string; text: string; link: string }> = {
    cyan:   { border: 'border-cyan-400/20',   hover_bg: 'hover:bg-cyan-400/5',   text: 'text-cyan-400',   link: 'text-cyan-400/60 hover:text-cyan-400' },
    purple: { border: 'border-purple-400/20', hover_bg: 'hover:bg-purple-400/5', text: 'text-purple-400', link: 'text-purple-400/60 hover:text-purple-400' },
    green:  { border: 'border-green-400/20',  hover_bg: 'hover:bg-green-400/5',  text: 'text-green-400',  link: 'text-green-400/60 hover:text-green-400' },
    pink:   { border: 'border-pink-400/20',   hover_bg: 'hover:bg-pink-400/5',   text: 'text-pink-400',   link: 'text-pink-400/60 hover:text-pink-400' },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-gray-200 p-5">
      <div className="max-w-3xl mx-auto">
        <NavTabs />

        <div className="text-center mb-12 mt-4">
          <h1 className="text-4xl font-light text-cyan-400 mb-2">8i11</h1>
          <p className="text-gray-500 text-sm">Creative tools and games by William Martin</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
          {categories.map((cat) => {
            const colors = color_map[cat.color];
            return (
              <div
                key={cat.title}
                className={`p-6 rounded-xl border ${colors.border} bg-white/5`}
              >
                <div className="text-3xl mb-3">{cat.icon}</div>
                <h2 className={`text-lg font-medium ${colors.text} mb-1`}>{cat.title}</h2>
                <p className="text-gray-400 text-sm leading-relaxed mb-3">{cat.description}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {cat.links.map((link) =>
                    link.external ? (
                      <a
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-xs ${colors.link} transition-colors`}
                      >
                        {link.label} ↗
                      </a>
                    ) : (
                      <Link
                        key={link.label}
                        href={link.href}
                        className={`text-xs ${colors.link} transition-colors`}
                      >
                        {link.label}
                      </Link>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <footer className="text-center text-xs text-gray-600 border-t border-white/10 pt-6 pb-4">
          <div className="flex justify-center gap-4">
            <Link href="/privacy" className="hover:text-cyan-400 transition-colors">Privacy Policy</Link>
            <span className="text-gray-700">·</span>
            <Link href="/terms" className="hover:text-cyan-400 transition-colors">Terms of Service</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
