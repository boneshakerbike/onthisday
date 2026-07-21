/**
 * Health hub - landing page for all health sub-pages
 */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import NavTabs from '@/components/nav_tabs';

const HEALTH_PAGES = [
  { label: 'Oura', href: '/health/oura', description: 'Sleep, readiness, HRV, stress, and activity from Oura Ring' },
  { label: 'Ride with GPS', href: '/health/ridewithgps', description: 'Recent cycling, walking, and strength activities' },
  { label: 'COROS', href: '/health/coros', description: 'Training status, recovery, and activity reports from COROS' },
];

export default function HealthHubPage() {
  useEffect(() => {
    document.title = '8i11 | Health';
  }, []);

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-gray-200 p-4">
      <NavTabs />
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-cyan-400 mb-6">Health</h1>
        <div className="space-y-3">
          {HEALTH_PAGES.map(({ label, href, description }) => (
            <Link
              key={href}
              href={href}
              className="block p-4 bg-[#0f0f1a] border border-white/10 rounded-lg hover:border-cyan-400/30 hover:bg-white/5 transition-all"
            >
              <div className="text-cyan-400 font-medium mb-1">{label}</div>
              <div className="text-sm text-gray-400">{description}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
