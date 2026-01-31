/**
 * Admin page - Reference guide for managing the app
 * Only visible to authenticated users
 */

'use client';

import { useState, useEffect } from 'react';
import NavTabs from '@/components/nav_tabs';

export default function AdminPage() {
  const [is_localhost, set_is_localhost] = useState(false);

  useEffect(() => {
    set_is_localhost(window.location.hostname === 'localhost');
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] text-white">
      <div className="max-w-3xl mx-auto p-6">
        <NavTabs is_localhost={is_localhost} />

        <h1 className="text-2xl font-bold text-cyan-400 mb-6">Admin Reference</h1>

        {/* Guest PIN Management */}
        <Section title="Managing Guest PINs" defaultOpen={true}>
          <p className="mb-3">
            Guest PINs let friends access the app without a GitHub account.
            PINs are stored securely in Vercel environment variables.
          </p>

          <h4 className="font-medium text-cyan-400 mt-4 mb-2">To add or change PINs:</h4>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Go to <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">Vercel Dashboard</a></li>
            <li>Select the <strong>onthisday</strong> project</li>
            <li>Go to <strong>Settings</strong> → <strong>Environment Variables</strong></li>
            <li>Find or create <code className="bg-white/10 px-1 rounded">GUEST_PINS</code></li>
            <li>Set value to comma-separated PINs: <code className="bg-white/10 px-1 rounded">mom1234,friend5678,work9012</code></li>
            <li>Click <strong>Save</strong></li>
            <li>Go to <strong>Deployments</strong> → click <strong>...</strong> on latest → <strong>Redeploy</strong></li>
          </ol>

          <h4 className="font-medium text-cyan-400 mt-4 mb-2">To revoke someone's access:</h4>
          <p className="text-gray-300">
            Remove their PIN from the list and redeploy. Other PINs keep working.
          </p>

          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-sm">
            <strong className="text-yellow-400">Note:</strong> The legacy <code className="bg-white/10 px-1 rounded">GUEST_PIN</code> variable still works alongside <code className="bg-white/10 px-1 rounded">GUEST_PINS</code>.
          </div>
        </Section>

        {/* GitHub User Management */}
        <Section title="Managing GitHub Users">
          <p className="mb-3">
            By default, only <code className="bg-white/10 px-1 rounded">boneshakerbike</code> can log in with GitHub.
          </p>

          <h4 className="font-medium text-cyan-400 mt-4 mb-2">To allow other GitHub users:</h4>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Go to <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">Vercel Dashboard</a> → <strong>onthisday</strong> → <strong>Settings</strong> → <strong>Environment Variables</strong></li>
            <li>Create <code className="bg-white/10 px-1 rounded">ALLOWED_GITHUB_USERS</code></li>
            <li>Set value to comma-separated usernames: <code className="bg-white/10 px-1 rounded">boneshakerbike,frienduser</code></li>
            <li>Save and redeploy</li>
          </ol>
        </Section>

        {/* Quick Links */}
        <Section title="Quick Links">
          <ul className="space-y-2">
            <li>
              <a href="https://vercel.com/boneshakerbike/onthisday/settings/environment-variables" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">
                Vercel Environment Variables →
              </a>
            </li>
            <li>
              <a href="https://vercel.com/boneshakerbike/onthisday/deployments" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">
                Vercel Deployments →
              </a>
            </li>
            <li>
              <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">
                Anthropic Console (API usage) →
              </a>
            </li>
            <li>
              <a href="https://github.com/boneshakerbike/onthisday" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">
                GitHub Repository →
              </a>
            </li>
          </ul>
        </Section>

        {/* Environment Variables Reference */}
        <Section title="Environment Variables Reference">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-white/10">
                  <th className="py-2 pr-4 text-gray-400">Variable</th>
                  <th className="py-2 text-gray-400">Purpose</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-cyan-400">GUEST_PINS</code></td>
                  <td className="py-2">Comma-separated guest PINs</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-cyan-400">GUEST_PIN</code></td>
                  <td className="py-2">Legacy single PIN (still works)</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-cyan-400">ALLOWED_GITHUB_USERS</code></td>
                  <td className="py-2">Comma-separated GitHub usernames</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-cyan-400">ANTHROPIC_API_KEY</code></td>
                  <td className="py-2">Claude API key for story generation</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-cyan-400">GITHUB_CLIENT_ID</code></td>
                  <td className="py-2">GitHub OAuth app ID</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-cyan-400">GITHUB_CLIENT_SECRET</code></td>
                  <td className="py-2">GitHub OAuth app secret</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4"><code className="text-cyan-400">NEXTAUTH_SECRET</code></td>
                  <td className="py-2">Session encryption key</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, defaultOpen = false, children }: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [is_open, set_is_open] = useState(defaultOpen);

  return (
    <div className="mb-4 border border-white/10 rounded-lg overflow-hidden">
      <button
        onClick={() => set_is_open(!is_open)}
        className="w-full px-4 py-3 flex items-center justify-between bg-white/5 hover:bg-white/10 transition-all text-left"
      >
        <span className="font-medium">{title}</span>
        <svg
          className={`w-5 h-5 transition-transform ${is_open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {is_open && (
        <div className="px-4 py-4 text-gray-300">
          {children}
        </div>
      )}
    </div>
  );
}
