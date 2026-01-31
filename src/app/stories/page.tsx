/**
 * Stories Management Page
 * List, copy, and manage all generated stories
 */

'use client';

import { useState, useEffect } from 'react';
import NavTabs from '@/components/nav_tabs';

export default function StoriesPage() {
  const [is_localhost, set_is_localhost] = useState(false);

  useEffect(() => {
    set_is_localhost(window.location.hostname === 'localhost');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-gray-200 p-5">
      <div className="max-w-3xl mx-auto">
        {/* Navigation */}
        <NavTabs is_localhost={is_localhost} />

        {/* Page heading */}
        <h1 className="text-center text-3xl font-light text-cyan-400 mb-8">
          Your Stories
        </h1>

        <div className="text-center py-16 text-gray-500">
          <p className="text-5xl mb-5">📚</p>
          <p className="mb-2">Coming soon</p>
          <p className="text-sm">Story management will be available here</p>
        </div>
      </div>
    </div>
  );
}
