/**
 * Tools Landing Page
 * Lists all available tools
 */

'use client';

import Link from 'next/link';
import NavTabs from '@/components/nav_tabs';

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
          <Link
            href="/tools/text-cleaner"
            className="block bg-white/5 rounded-xl p-6 border border-white/10 hover:border-cyan-400 transition-all"
          >
            <h2 className="text-xl text-white mb-2">What Am I Trying To Say</h2>
            <p className="text-gray-400 text-sm">Paste rough text — get it cleaned up for clarity, then edit and copy</p>
          </Link>
          <Link
            href="/tools/markdown"
            className="block bg-white/5 rounded-xl p-6 border border-white/10 hover:border-cyan-400 transition-all"
          >
            <h2 className="text-xl text-white mb-2">Markdown Converter</h2>
            <p className="text-gray-400 text-sm">Convert rich text to Markdown and back</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
