/**
 * Tools Landing Page
 * Lists all available tools — sourced from src/lib/tools.ts
 */

'use client';

import Link from 'next/link';
import NavTabs from '@/components/nav_tabs';
import { TOOLS } from '@/lib/tools';

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-gray-200 p-5">
      <div className="max-w-3xl mx-auto">
        {/* Navigation */}
        <NavTabs />

        {/* Page heading */}
        <h1 className="text-center text-3xl font-light text-cyan-400 mb-8">
          Writing Tools
        </h1>

        <div className="grid gap-4">
          {TOOLS.map((tool) => (
            <Link
              key={tool.path}
              href={tool.path}
              className="block bg-white/5 rounded-xl p-6 border border-white/10 hover:border-cyan-400 transition-all"
            >
              <h2 className="text-xl text-white mb-2">{tool.label}</h2>
              <p className="text-gray-400 text-sm">{tool.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
