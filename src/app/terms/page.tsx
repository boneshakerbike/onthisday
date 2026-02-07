/**
 * Terms of Service - Legit but with personality
 * Public page, no auth required
 */

'use client';

import { useState, useEffect } from 'react';
import NavTabs from '@/components/nav_tabs';

export default function TermsPage() {
  const [is_localhost, set_is_localhost] = useState(false);

  useEffect(() => {
    set_is_localhost(window.location.hostname === 'localhost');
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] text-white">
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <NavTabs is_localhost={is_localhost} />

        <h1 className="text-2xl font-bold text-cyan-400 mb-2">Terms of Service</h1>
        <p className="text-gray-500 text-sm mb-8">Last updated: February 7, 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-gray-300">

          <section>
            <h2 className="text-lg font-semibold text-gray-200">The Gist</h2>
            <p>
              This is a personal project. It&apos;s not a startup, it&apos;s not a platform, and
              it&apos;s definitely not backed by venture capital. By using this site, you agree to
              be cool about it. That&apos;s basically the whole thing, but lawyers like specifics,
              so here we go.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200">What This Service Is</h2>
            <p>
              8i11 is a collection of personal tools including a Substack archive explorer, AI-powered
              writing tools, a prompt library, health dashboards, and some games. It&apos;s built by
              one person for personal use and shared with a small circle of people who were given access.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200">Access</h2>
            <p>
              Access is by invitation only, via GitHub OAuth or a guest PIN. If you have access,
              someone trusted you with it. Don&apos;t share your PIN like it&apos;s a Netflix password.
              We reserve the right to revoke access at any time for any reason, but realistically
              the only reason would be if something weird is going on.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200">Your Content</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Anything you create or submit (prompts, suggestions, etc.) belongs to you.</li>
              <li>We store it so the app works. That&apos;s the extent of our interest in it.</li>
              <li>We won&apos;t use your content for training AI models, selling data, or anything
                  other than showing it back to you.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200">AI-Generated Content</h2>
            <p>
              This site uses Claude (by Anthropic) to generate stories, review prompts, and other
              AI-powered features. A few things to keep in mind:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>AI output is provided as-is. It might be brilliant, it might be nonsense. Usually somewhere in between.</li>
              <li>Don&apos;t rely on AI-generated content for medical, legal, or financial decisions. It&apos;s a writing tool, not a doctor.</li>
              <li>AI features cost real money per use. Don&apos;t abuse them. We&apos;re not made of API credits.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200">Health Data</h2>
            <p>
              If you connect a health service (like Oura Ring), the data displayed is for
              informational purposes only. This is not a medical device, not a diagnostic tool,
              and not a substitute for professional medical advice. If your readiness score is 12,
              see a doctor, not this dashboard.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200">Availability</h2>
            <p>
              This site runs on Vercel&apos;s free tier and a serverless database. It&apos;s
              generally reliable, but we make no guarantees about uptime, performance, or
              availability. If it goes down, it&apos;ll come back when it comes back. This is not
              an SLA situation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200">Don&apos;t Be a Jerk</h2>
            <p>The catchall clause. Don&apos;t:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Try to break things on purpose</li>
              <li>Use the AI features to generate harmful content</li>
              <li>Attempt to access other people&apos;s data</li>
              <li>Hammer the API endpoints like you&apos;re stress-testing AWS</li>
              <li>Do anything that would make us regret giving you access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200">Limitation of Liability</h2>
            <p>
              This is a personal project provided &ldquo;as is.&rdquo; We&apos;re not liable for
              anything that happens as a result of using this site, including but not limited to:
              bad AI advice, hurt feelings from a low readiness score, or time lost playing Frogger
              when you should have been working. Use at your own risk and discretion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200">Changes</h2>
            <p>
              These terms may be updated occasionally. When they are, the date at the top changes.
              Continued use of the site means you&apos;re good with the current terms. If you&apos;re
              not, the exit is the same way you came in.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200">Contact</h2>
            <p>
              Same as the privacy policy... there&apos;s one of us, and you probably already
              know how to reach him.
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}
