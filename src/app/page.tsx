/**
 * On This Day - Main Page
 * Find Substack posts from any date across all years
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import JSZip from 'jszip';
import Papa from 'papaparse';

interface Post {
  post_id: string;
  title: string;
  subtitle: string | null;
  post_date: string;
  year: number;
  years_ago: number;
  blurb: string | null;
  url: string;
}

interface PostsResponse {
  date: { month: number; day: number; display: string };
  posts: Post[];
  archive: string | null;
  total_posts: number;
  error?: string;
}

interface GenerateResponse {
  success: boolean;
  story: string;
  posts_used: number;
  usage: { input_tokens: number; output_tokens: number };
  error?: string;
}

export default function OnThisDay() {
  const { data: session } = useSession();
  const [date, set_date] = useState<{ month: number; day: number; display: string } | null>(null);
  const [posts, set_posts] = useState<Post[]>([]);
  const [archive, set_archive] = useState<string | null>(null);
  const [total_posts, set_total_posts] = useState(0);
  const [loading, set_loading] = useState(true);
  const [copy_status, set_copy_status] = useState('');
  const [upload_status, set_upload_status] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [uploading, set_uploading] = useState(false);

  // Story generation state
  const [has_api_key, set_has_api_key] = useState(false);
  const [generating, set_generating] = useState(false);
  const [generated_story, set_generated_story] = useState<string | null>(null);
  const [story_copy_status, set_story_copy_status] = useState('');
  const [generate_error, set_generate_error] = useState<string | null>(null);
  const [token_usage, set_token_usage] = useState<{ input: number; output: number } | null>(null);

  // Check if API key is configured
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => set_has_api_key(data.has_api_key))
      .catch(() => set_has_api_key(false));
  }, []);

  const fetch_posts = useCallback(async (month?: number, day?: number) => {
    set_loading(true);
    set_generated_story(null);
    set_generate_error(null);
    set_token_usage(null);
    try {
      const params = month && day ? `?date=${month}-${day}` : '';
      const res = await fetch(`/api/posts${params}`);
      const data: PostsResponse = await res.json();

      set_date(data.date);
      set_posts(data.posts);
      set_archive(data.archive);
      set_total_posts(data.total_posts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
    set_loading(false);
  }, []);

  useEffect(() => {
    fetch_posts();
  }, [fetch_posts]);

  const handle_date_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      const [, month, day] = value.split('-').map(Number);
      fetch_posts(month, day);
    }
  };

  const go_to_relative_day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    fetch_posts(d.getMonth() + 1, d.getDate());
  };

  const copy_for_substack = async (version: 'simple' | 'full') => {
    if (!posts.length) return;

    let html = '<h2>On This Day</h2>\n';
    for (const post of posts) {
      if (version === 'simple') {
        html += `<p>${post.year}: <a href="${post.url}">${post.title}</a></p>\n`;
      } else {
        const blurb_part = post.blurb ? ` – ${post.blurb}` : '';
        html += `<p>${post.year}: <a href="${post.url}">${post.title}</a>${blurb_part}</p>\n`;
      }
    }

    try {
      const blob = new Blob([html], { type: 'text/html' });
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
      set_copy_status('Copied!');
    } catch {
      const text = posts.map(p => `${p.year}: ${p.title} - ${p.url}`).join('\n');
      await navigator.clipboard.writeText(text);
      set_copy_status('Copied as text');
    }
    setTimeout(() => set_copy_status(''), 2000);
  };

  const generate_story = async () => {
    if (!date || posts.length === 0) return;

    set_generating(true);
    set_generate_error(null);
    set_generated_story(null);
    set_token_usage(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: date.month, day: date.day })
      });

      const data: GenerateResponse = await res.json();

      if (data.success) {
        set_generated_story(data.story);
        set_token_usage({ input: data.usage.input_tokens, output: data.usage.output_tokens });
      } else {
        set_generate_error(data.error || 'Failed to generate story');
      }
    } catch (error) {
      set_generate_error(error instanceof Error ? error.message : 'Failed to generate story');
    }

    set_generating(false);
  };

  const copy_story = async () => {
    if (!generated_story) return;

    try {
      const blob = new Blob([generated_story], { type: 'text/html' });
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
      set_story_copy_status('Copied!');
    } catch {
      const temp = document.createElement('div');
      temp.innerHTML = generated_story;
      await navigator.clipboard.writeText(temp.textContent || '');
      set_story_copy_status('Copied as text');
    }
    setTimeout(() => set_story_copy_status(''), 2000);
  };

  const handle_upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    set_uploading(true);
    set_upload_status(null);

    try {
      const zip = await JSZip.loadAsync(file);

      const csv_file = zip.file('posts.csv') || zip.file(/posts\.csv$/i)[0];
      if (!csv_file) {
        throw new Error('posts.csv not found in archive');
      }

      const csv_text = await csv_file.async('text');
      const parsed = Papa.parse<Record<string, string>>(csv_text, { header: true });

      if (parsed.errors.length > 0) {
        console.warn('CSV parse warnings:', parsed.errors);
      }

      const html_files: Record<string, string> = {};
      const html_entries = zip.file(/posts\/.*\.html$/i);

      for (const entry of html_entries) {
        const html = await entry.async('text');
        const match = entry.name.match(/posts\/(\d+\.[^/]+)\.html$/i);
        if (match) {
          html_files[match[1]] = html;
        }
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          posts: parsed.data,
          html_files
        })
      });

      const result = await res.json();

      if (result.success) {
        set_upload_status({ type: 'success', message: `Loaded ${result.count} posts from ${file.name}` });
        if (date) {
          fetch_posts(date.month, date.day);
        }
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      set_upload_status({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to process archive'
      });
    }

    set_uploading(false);
    e.target.value = '';
  };

  const get_years_text = (years_ago: number) => {
    if (years_ago === 0) return 'this year';
    if (years_ago === 1) return '1 year ago';
    return `${years_ago} years ago`;
  };

  const today = new Date();
  const date_input_value = date
    ? `${today.getFullYear()}-${date.month.toString().padStart(2, '0')}-${date.day.toString().padStart(2, '0')}`
    : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-gray-200 p-5">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-center text-3xl font-light text-cyan-400 mb-2">On This Day</h1>
        <p className="text-center text-gray-500 mb-8">{date?.display || 'Loading...'}</p>

        {/* User info and logout */}
        {session && (
          <div className="text-center mb-4 text-sm text-gray-500">
            Signed in as {session.user?.name || session.user?.email || 'Guest'}
            <button
              onClick={() => signOut()}
              className="ml-3 text-gray-400 hover:text-cyan-400 underline"
            >
              Sign out
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="text-center mb-5 pb-0 border-b-0">
          <a href="http://localhost:8080" className="text-cyan-400 hover:underline mx-4">
            Dev Home
          </a>
          <a
            href="https://8i11.substack.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:underline mx-4"
          >
            Visit Substack
          </a>
        </div>

        {/* Archive info */}
        {archive && (
          <p className="text-center text-xs text-gray-600 mb-5">
            Archive: {archive} ({total_posts.toLocaleString()} posts)
          </p>
        )}

        {/* Date picker */}
        <div className="text-center mb-5">
          <input
            type="date"
            value={date_input_value}
            onChange={handle_date_change}
            className="px-4 py-2 text-base border border-white/20 rounded-lg bg-white/10 text-white cursor-pointer mr-3"
          />
        </div>

        {/* Quick dates */}
        <div className="text-center mb-5">
          <button
            onClick={() => go_to_relative_day(-1)}
            className="inline-block px-3 py-1 m-1 bg-white/5 rounded-full text-gray-400 text-sm hover:bg-cyan-400/20 hover:text-cyan-400"
          >
            Yesterday
          </button>
          <button
            onClick={() => go_to_relative_day(0)}
            className="inline-block px-3 py-1 m-1 bg-white/5 rounded-full text-gray-400 text-sm hover:bg-cyan-400/20 hover:text-cyan-400"
          >
            Today
          </button>
          <button
            onClick={() => go_to_relative_day(1)}
            className="inline-block px-3 py-1 m-1 bg-white/5 rounded-full text-gray-400 text-sm hover:bg-cyan-400/20 hover:text-cyan-400"
          >
            Tomorrow
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-16 text-gray-500">
            <p>Loading...</p>
          </div>
        )}

        {/* No posts state */}
        {!loading && total_posts === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-5xl mb-5">📦</p>
            <p className="mb-2">No archive loaded</p>
            <p className="text-sm">Upload your Substack export below to get started</p>
          </div>
        )}

        {/* Empty date state */}
        {!loading && total_posts > 0 && posts.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-5xl mb-5">📭</p>
            <p>No posts found for {date?.display}</p>
          </div>
        )}

        {/* Posts */}
        {!loading && posts.length > 0 && (
          <>
            <div className="text-center text-6xl font-extralight text-cyan-400 mb-2">
              {posts.length}
            </div>
            <p className="text-center text-gray-500 mb-8">
              post{posts.length !== 1 ? 's' : ''} on this day
            </p>

            {/* Export buttons */}
            <div className="text-center mb-6">
              <button
                onClick={() => copy_for_substack('simple')}
                className="px-5 py-2 mx-1 border-2 border-cyan-400 rounded-lg bg-transparent text-cyan-400 text-sm font-medium hover:bg-cyan-400 hover:text-[#1a1a2e] transition-all"
              >
                Copy Titles Only
              </button>
              <button
                onClick={() => copy_for_substack('full')}
                className="px-5 py-2 mx-1 border-2 border-cyan-400 rounded-lg bg-transparent text-cyan-400 text-sm font-medium hover:bg-cyan-400 hover:text-[#1a1a2e] transition-all"
              >
                Copy with Blurbs
              </button>
              {copy_status && (
                <span className="ml-3 text-green-400 text-sm">{copy_status}</span>
              )}
            </div>

            {/* Generate Story button */}
            {has_api_key && (
              <div className="text-center mb-8">
                <button
                  onClick={generate_story}
                  disabled={generating}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white font-medium hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? 'Writing...' : 'Generate Story'}
                </button>
              </div>
            )}

            {/* Generate error */}
            {generate_error && (
              <div className="mb-6 p-4 bg-red-400/10 border border-red-400/30 rounded-lg text-red-400 text-center">
                {generate_error}
              </div>
            )}

            {/* Generated story */}
            {generated_story && (
              <div className="mb-8 p-6 bg-white/5 border border-purple-400/30 rounded-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-purple-400 font-medium">Generated Story</h3>
                  <div className="flex items-center gap-3">
                    {token_usage && (
                      <span className="text-xs text-gray-600">
                        {token_usage.input + token_usage.output} tokens
                      </span>
                    )}
                    <button
                      onClick={copy_story}
                      className="px-4 py-1 border border-purple-400 rounded text-purple-400 text-sm hover:bg-purple-400 hover:text-white transition-all"
                    >
                      Copy for Substack
                    </button>
                    {story_copy_status && (
                      <span className="text-green-400 text-sm">{story_copy_status}</span>
                    )}
                  </div>
                </div>
                <div
                  className="prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: generated_story }}
                />
              </div>
            )}

            {/* Post cards */}
            {posts.map((post) => (
              <div
                key={post.post_id}
                className="bg-white/5 rounded-xl p-5 mb-4 border border-white/10 hover:translate-x-1 hover:border-cyan-400 transition-all"
              >
                <span className="inline-block bg-cyan-400 text-[#1a1a2e] px-3 py-1 rounded-full text-sm font-semibold mb-2">
                  {post.year}
                </span>
                <span className="text-gray-500 text-sm ml-3">
                  {get_years_text(post.years_ago)}
                </span>
                <h2 className="text-xl text-white mb-2">
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-cyan-400"
                  >
                    {post.title}
                  </a>
                </h2>
                {post.blurb && (
                  <p className="text-gray-400 text-sm leading-relaxed">{post.blurb}</p>
                )}
              </div>
            ))}
          </>
        )}

        {/* Bottom navigation */}
        <div className="text-center mt-8 pt-5 border-t border-white/10">
          <a href="http://localhost:8080" className="text-cyan-400 hover:underline mx-4">
            Dev Home
          </a>
          <a
            href="https://8i11.substack.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:underline mx-4"
          >
            Visit Substack
          </a>
        </div>

        {/* Upload section */}
        <div className="mt-10 pt-5 border-t border-white/10">
          <details className="text-center">
            <summary className="cursor-pointer text-gray-600 text-sm hover:text-cyan-400">
              Update Archive
            </summary>
            <div className="mt-5 p-5 bg-white/[0.03] rounded-xl">
              {upload_status && (
                <p
                  className={`mb-4 p-3 rounded-lg ${
                    upload_status.type === 'success'
                      ? 'text-green-400 bg-green-400/10'
                      : 'text-red-400 bg-red-400/10'
                  }`}
                >
                  {upload_status.message}
                </p>
              )}
              <p className="text-gray-500 mb-4">Upload a new Substack export (.zip)</p>
              <input
                type="file"
                accept=".zip"
                onChange={handle_upload}
                disabled={uploading}
                className="text-gray-400 mr-3"
              />
              {uploading && <span className="text-cyan-400">Processing...</span>}
              <p className="text-xs text-gray-600 mt-4">
                Get your archive from{' '}
                <a
                  href="https://8i11.substack.com/publish/settings"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline"
                >
                  Substack Settings
                </a>{' '}
                → Export
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
