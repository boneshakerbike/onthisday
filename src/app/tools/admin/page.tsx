/**
 * Admin page - Reference guide for managing the app
 * Only visible to authenticated users
 */

'use client';

import { useState } from 'react';
import NavTabs from '@/components/nav_tabs';

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] text-white">
      <div className="max-w-3xl mx-auto p-6">
        <NavTabs />

        <h1 className="text-2xl font-bold text-cyan-400 mb-4">Admin Reference</h1>

        {/* Quick Links - chiclets */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { label: 'Deploys', href: 'https://vercel.com/boneshakerbikes-projects/~/deployments' },
            { label: 'Repo', href: 'https://github.com/boneshakerbike/onthisday' },
            { label: 'Console', href: 'https://console.anthropic.com' },
            { label: 'Usage', href: 'https://claude.ai/settings/usage' },
            { label: 'Turso', href: 'https://app.turso.tech' },
            { label: 'Oura Dev', href: 'https://developer.ouraring.com/applications' },
            { label: 'Scheduled', href: 'https://8i11.substack.com/publish/posts/scheduled' },
            { label: 'Env Vars', href: 'https://vercel.com/boneshakerbikes-projects/8i11/settings/environment-variables' },
          ].map(link => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-sm rounded-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/20 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

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

        {/* Reviewer Agent Keys */}
        <Section title="Reviewer Agent Keys (Chipboard Read-Only)">
          <p className="mb-3">
            Read-only keys for reviewer agents (Codex, Gemini, etc). Grants <strong>GET</strong> access
            to <code className="bg-white/10 px-1 rounded">/api/suggestions</code> only — no writes, no worklog.
          </p>

          <h4 className="font-medium text-cyan-400 mt-4 mb-2">Agent setup:</h4>
          <p className="text-gray-300 mb-2">Set as env var, use in header:</p>
          <code className="bg-white/10 px-2 py-1 rounded text-xs block mb-1">export CHIPBOARD_READ_KEY="&lt;key&gt;"</code>
          <code className="bg-white/10 px-2 py-1 rounded text-xs block mb-3">curl -H "X-Chipboard-Key: $CHIPBOARD_READ_KEY" https://8i11.vercel.app/api/suggestions</code>

          <h4 className="font-medium text-cyan-400 mt-4 mb-2">Admin: add/revoke keys</h4>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Go to <a href="https://vercel.com/boneshakerbike/onthisday/settings/environment-variables" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">Vercel Environment Variables</a></li>
            <li>Edit <code className="bg-white/10 px-1 rounded">CHIPBOARD_READ_KEYS</code> — comma-separated list of keys</li>
            <li>Save and redeploy</li>
          </ol>
          <p className="text-gray-400 text-sm mt-2">
            Generate keys with: <code className="bg-white/10 px-1 rounded">python3 -c "import secrets; print(secrets.token_urlsafe(32))"</code>
          </p>
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
                  <td className="py-2 pr-4 font-medium text-gray-400 pt-4" colSpan={2}>Auth</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-cyan-400">GUEST_PINS</code></td>
                  <td className="py-2">Comma-separated guest PINs (agent + human access)</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-cyan-400">GUEST_PIN</code></td>
                  <td className="py-2">Legacy single PIN (still works)</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-cyan-400">CHIPBOARD_READ_KEYS</code></td>
                  <td className="py-2">Comma-separated read-only keys for reviewer agents (Chipboard GET only)</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-cyan-400">ALLOWED_GITHUB_USERS</code></td>
                  <td className="py-2">Comma-separated GitHub login names allowed to authenticate</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-cyan-400">GITHUB_CLIENT_ID</code></td>
                  <td className="py-2">GitHub OAuth app ID</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-cyan-400">GITHUB_CLIENT_SECRET</code></td>
                  <td className="py-2">GitHub OAuth app secret</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-cyan-400">NEXTAUTH_SECRET</code></td>
                  <td className="py-2">Session encryption key</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 font-medium text-gray-400 pt-4" colSpan={2}>Database</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-cyan-400">TURSO_DATABASE_URL</code></td>
                  <td className="py-2">Production Turso (libSQL) database URL</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-cyan-400">TURSO_AUTH_TOKEN</code></td>
                  <td className="py-2">Production Turso auth token</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 font-medium text-gray-400 pt-4" colSpan={2}>AI &amp; Integrations</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-cyan-400">ANTHROPIC_API_KEY</code></td>
                  <td className="py-2">Claude API key (stories, intro copy, prompt review, knowledge diff, Chipboard AI cleanup)</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-cyan-400">OURA_CLIENT_ID</code></td>
                  <td className="py-2">Oura Ring OAuth app ID</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-cyan-400">OURA_CLIENT_SECRET</code></td>
                  <td className="py-2">Oura Ring OAuth app secret</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 font-medium text-gray-400 pt-4" colSpan={2}>Agents</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4"><code className="text-cyan-400">WORKLOG_API_KEY</code></td>
                  <td className="py-2">API key for agent worklog read and write (<code className="bg-white/10 px-1 rounded">X-Worklog-Key</code> header)</td>
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
