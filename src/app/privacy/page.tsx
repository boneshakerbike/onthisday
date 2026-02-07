/**
 * Privacy Policy - Legit but with personality
 * Public page, no auth required
 */

'use client';

import { useState, useEffect } from 'react';
import NavTabs from '@/components/nav_tabs';

export default function PrivacyPage() {
  const [is_localhost, set_is_localhost] = useState(false);

  useEffect(() => {
    set_is_localhost(window.location.hostname === 'localhost');
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] text-white">
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <NavTabs is_localhost={is_localhost} />

        <h1 className="text-2xl font-bold text-cyan-400 mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-8">Last updated: February 7, 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-gray-300">

          <section>
            <h2 className="text-lg font-semibold text-gray-200">The Short Version</h2>
            <p>
              This is a personal project built by one guy on a Chromebook. We collect the absolute
              minimum data needed to make things work, we don&apos;t sell anything to anyone, and
              if you somehow ended up here by accident... welcome, but there&apos;s not much to worry about.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200">What We Collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Authentication data:</strong> If you log in via GitHub OAuth, we receive your
                GitHub username. That&apos;s it. We don&apos;t ask for your email, your repos, or
                your deepest secrets.
              </li>
              <li>
                <strong>Guest PINs:</strong> If you use a guest PIN, we validate it server-side. We
                don&apos;t log who uses which PIN because, frankly, we don&apos;t care that much.
              </li>
              <li>
                <strong>Health data (Oura Ring):</strong> If you connect an Oura Ring account, we
                fetch sleep, readiness, and activity scores via the Oura API. This data is displayed
                to you and only you. It is not stored permanently, shared with third parties, or
                used for anything other than showing you your own numbers.
              </li>
              <li>
                <strong>Content you create:</strong> Stories, prompts, and suggestions you submit
                are stored in our database so they&apos;re there when you come back. Revolutionary concept.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200">What We Don&apos;t Do</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Sell your data. To anyone. Ever. We couldn&apos;t even if we wanted to... there&apos;s not enough of it to be interesting.</li>
              <li>Track you across the internet. No analytics, no pixels, no fingerprinting.</li>
              <li>Send you emails. We don&apos;t have your email. Problem solved.</li>
              <li>Share data with third parties, except the APIs needed to make features work (Anthropic for AI, Oura for health data, Vercel for hosting).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200">Third-Party Services</h2>
            <p>We use a few services to keep the lights on:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Vercel:</strong> Hosts the site. They have their own <a href="https://vercel.com/legal/privacy-policy" className="text-cyan-400 hover:underline" target="_blank" rel="noopener noreferrer">privacy policy</a>.</li>
              <li><strong>Turso:</strong> Stores our database. Your data lives on their servers.</li>
              <li><strong>Anthropic (Claude):</strong> Powers AI features. Content sent for AI generation is processed per <a href="https://www.anthropic.com/privacy" className="text-cyan-400 hover:underline" target="_blank" rel="noopener noreferrer">Anthropic&apos;s privacy policy</a>.</li>
              <li><strong>Oura:</strong> If connected, we fetch your health data via their API per <a href="https://ouraring.com/privacy-policy" className="text-cyan-400 hover:underline" target="_blank" rel="noopener noreferrer">Oura&apos;s privacy policy</a>.</li>
              <li><strong>GitHub:</strong> Handles OAuth login. They know you clicked &ldquo;Authorize.&rdquo;</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200">Cookies</h2>
            <p>
              We use a session cookie for authentication. It&apos;s not tracking you, it&apos;s just
              remembering that you logged in. One cookie. That&apos;s the whole cookie situation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200">Data Retention</h2>
            <p>
              Your content stays until you delete it or until the heat death of the universe,
              whichever comes first. If you want something removed, just ask.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200">Changes</h2>
            <p>
              If this policy changes, it&apos;ll be updated right here. We won&apos;t send you a
              14-page email about it because, again, we don&apos;t have your email.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200">Contact</h2>
            <p>
              Questions? Concerns? Found a bug? This is a personal project, so just reach out
              through the usual channels. You know who we are. There&apos;s literally one of us.
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}
