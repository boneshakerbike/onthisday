/**
 * On This Day - Main Page
 * Find Substack posts from any date across all years
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import JSZip from 'jszip';
import Papa from 'papaparse';
import NavTabs from '@/components/nav_tabs';

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
  story_id?: string;
  posts_used: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
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
  const [full_reimport, set_full_reimport] = useState(false);

  // Story generation state
  const [has_api_key, set_has_api_key] = useState(false);
  const [generating, set_generating] = useState(false);
  const [generated_story, set_generated_story] = useState<string | null>(null);
  const [story_id, set_story_id] = useState<string | null>(null);
  const [existing_story, set_existing_story] = useState<{ id: string; created_at: string } | null>(null);
  const [story_copy_status, set_story_copy_status] = useState('');
  const [generate_error, set_generate_error] = useState<string | null>(null);
  const [token_usage, set_token_usage] = useState<{ input: number; output: number; cached: number } | null>(null);


  // Fetch error state (for /api/posts failures)
  const [fetch_error, set_fetch_error] = useState<string | null>(null);

  // RSS sync state
  const [sync_status, set_sync_status] = useState<string | null>(null);

  // AI copy state
  const [ai_copying, set_ai_copying] = useState(false);

  // Copy preview (rendered HTML shown in place of post cards)
  const [copy_preview, set_copy_preview] = useState<string | null>(null);

  const fetch_posts = useCallback(async (month?: number, day?: number) => {
    set_loading(true);
    set_fetch_error(null);
    set_generated_story(null);
    set_story_id(null);
    set_existing_story(null);
    set_generate_error(null);
    set_token_usage(null);
    set_copy_preview(null);
    try {
      const params = month && day ? `?date=${month}-${day}` : '';
      const res = await fetch(`/api/posts${params}`);
      if (!res.ok) {
        throw new Error(`Server error (${res.status})`);
      }
      const data: PostsResponse = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      set_date(data.date);
      set_posts(data.posts);
      set_archive(data.archive);
      set_total_posts(data.total_posts);

      // Check for existing story for this date
      if (month && day) {
        const date_key = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const story_res = await fetch(`/api/story?date=${date_key}`);
        const story_data = await story_res.json();
        if (story_data.story) {
          set_existing_story({
            id: story_data.story.id,
            created_at: story_data.story.created_at
          });
        }
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      set_fetch_error(
        error instanceof Error ? error.message : 'Could not load posts. Check your connection and try again.'
      );
    }
    set_loading(false);
  }, []);

  // Set page title and check if API key is configured
  useEffect(() => {
    document.title = '8i11 | On This Day';
    fetch('/api/config')
      .then(res => res.json())
      .then(data => set_has_api_key(data.has_api_key))
      .catch(() => set_has_api_key(false));

    // Background RSS sync — only for GitHub OAuth admin users
    const user_id = (session?.user as { id?: string } | undefined)?.id;
    const is_github_user = session && user_id && user_id !== 'guest';
    if (is_github_user) {
      set_sync_status('Checking for new posts...');
      fetch('/api/sync')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            set_sync_status(data.message);
            // Clear status after 3 seconds
            setTimeout(() => set_sync_status(null), 3000);
            // If new posts were added, refresh the current view
            if (data.added > 0) {
              const now = new Date();
              fetch_posts(now.getMonth() + 1, now.getDate());
            }
          } else {
            set_sync_status(null);
          }
        })
        .catch(() => set_sync_status(null));
    }
  }, [fetch_posts, session]);

  useEffect(() => {
    // Always use client's local date to avoid server timezone issues
    const now = new Date();
    fetch_posts(now.getMonth() + 1, now.getDate());
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
    if (!posts.length || !date) return;

    // Calculate year span for intro
    const years = posts.map(p => p.year).sort((a, b) => a - b);
    const earliest_year = years[0];
    const latest_year = years[years.length - 1];
    const year_span = latest_year - earliest_year;

    // Build intro paragraph
    const post_word = posts.length === 1 ? 'post' : 'posts';
    const year_range = year_span > 0
      ? `Since ${earliest_year}, I have written ${posts.length} ${post_word} that landed on this date.`
      : `I have ${posts.length} ${post_word} from ${earliest_year} on this date.`;

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
      try {
        const text = posts.map(p => `${p.year}: ${p.title} - ${p.url}`).join('\n');
        await navigator.clipboard.writeText(text);
        set_copy_status('Copied as text');
      } catch {
        set_copy_status('Copy failed');
      }
    }
    set_copy_preview(html);
    setTimeout(() => set_copy_status(''), 3000);
  };

  const copy_with_ai_intro = async () => {
    if (!posts.length || !date) return;

    set_ai_copying(true);
    set_copy_status('');

    try {
      // Call the AI intro endpoint
      const res = await fetch('/api/intro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_display: date.display,
          posts: posts.map(p => ({
            year: p.year,
            title: p.title,
            blurb: p.blurb
          }))
        })
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate intro');
      }

      // Build HTML with AI intro
      let html = '<h2>On This Day</h2>\n';
      html += `<p>${data.intro}</p>\n`;

      for (const post of posts) {
        const blurb_part = post.blurb ? ` – ${post.blurb}` : '';
        html += `<p>${post.year}: <a href="${post.url}">${post.title}</a>${blurb_part}</p>\n`;
      }

      // Copy to clipboard (rich HTML with plain text fallback)
      try {
        const blob = new Blob([html], { type: 'text/html' });
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
        set_copy_status('Copied with AI intro!');
      } catch {
        const text = `On This Day\n\n${data.intro}\n\n` +
          posts.map(p => {
            const blurb_part = p.blurb ? ` – ${p.blurb}` : '';
            return `${p.year}: ${p.title}${blurb_part} - ${p.url}`;
          }).join('\n');
        await navigator.clipboard.writeText(text);
        set_copy_status('Copied with AI intro!');
      }
      set_copy_preview(html);

    } catch (error) {
      console.error('AI copy error:', error);
      set_copy_status('AI intro failed');
    }

    set_ai_copying(false);
    setTimeout(() => set_copy_status(''), 3000);
  };

  const generate_story = async () => {
    if (!date || posts.length === 0) return;

    set_generating(true);
    set_generate_error(null);
    set_generated_story(null);
    set_story_id(null);
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
        set_story_id(data.story_id || null);
        // Update existing_story to the newly generated one
        if (data.story_id) {
          set_existing_story({
            id: data.story_id,
            created_at: new Date().toISOString()
          });
        }
        set_token_usage({
          input: data.usage.input_tokens,
          output: data.usage.output_tokens,
          cached: data.usage.cache_read_input_tokens || 0
        });
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
      set_story_copy_status('Copied for Substack!');
    } catch {
      try {
        const temp = document.createElement('div');
        temp.innerHTML = generated_story;
        await navigator.clipboard.writeText(temp.textContent || '');
        set_story_copy_status('Copied as text');
      } catch {
        set_story_copy_status('Copy failed');
      }
    }
    setTimeout(() => set_story_copy_status(''), 3000);
  };

  const copy_story_social = async () => {
    if (!generated_story || !date || !story_id) return;

    try {
      // Calculate year span
      const years = posts.map(p => p.year).sort((a, b) => a - b);
      const year_range = years.length > 1
        ? `${years[0]}-${years[years.length - 1]}`
        : `${years[0]}`;

      // Build short social text (~280 chars max)
      const story_url = `${window.location.origin}/story/${story_id}`;
      const text = `On This Day: ${date.display}\n\n${posts.length} post${posts.length !== 1 ? 's' : ''} from my journal, ${year_range}.\n\n${story_url}`;

      await navigator.clipboard.writeText(text);
      set_story_copy_status('Copied for Social!');
    } catch {
      set_story_copy_status('Copy failed');
    }
    setTimeout(() => set_story_copy_status(''), 3000);
  };

  const copy_story_markdown = async () => {
    if (!generated_story) return;

    try {
      let md = generated_story;
      // Convert links to markdown format
      md = md.replace(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi, '[$2]($1)');
      // Convert headers
      md = md.replace(/<h1[^>]*>([^<]+)<\/h1>/gi, '# $1\n\n');
      md = md.replace(/<h2[^>]*>([^<]+)<\/h2>/gi, '## $1\n\n');
      md = md.replace(/<h3[^>]*>([^<]+)<\/h3>/gi, '### $1\n\n');
      // Convert paragraphs
      md = md.replace(/<\/p>/gi, '\n\n');
      md = md.replace(/<p[^>]*>/gi, '');
      // Remove any remaining HTML tags
      md = md.replace(/<[^>]+>/g, '');
      // Clean up whitespace
      md = md.replace(/\n{3,}/g, '\n\n').trim();
      // Decode HTML entities
      const temp = document.createElement('div');
      temp.innerHTML = md;
      md = temp.textContent || md;

      await navigator.clipboard.writeText(md);
      set_story_copy_status('Copied as Markdown!');
    } catch {
      set_story_copy_status('Copy failed');
    }
    setTimeout(() => set_story_copy_status(''), 3000);
  };

  const copy_story_link = async () => {
    if (!story_id) return;

    try {
      const base_url = window.location.origin;
      const link = `${base_url}/story/${story_id}`;
      await navigator.clipboard.writeText(link);
      set_story_copy_status('Link copied!');
    } catch {
      set_story_copy_status('Copy failed');
    }
    setTimeout(() => set_story_copy_status(''), 3000);
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

      // Step 1: Initialize (clear if full reimport, otherwise just set archive info)
      set_upload_status({ type: 'success', message: full_reimport ? 'Clearing database...' : 'Preparing incremental import...' });
      const init_res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_type: full_reimport ? 'clear' : 'init',
          filename: file.name
        })
      });

      const init_result = await init_res.json();
      if (!init_result.success) {
        throw new Error(init_result.error || 'Failed to initialize');
      }

      // Step 2: Upload posts in batches
      const posts_batch_size = 500;
      let total_processed = 0;
      let total_new = 0;
      for (let i = 0; i < parsed.data.length; i += posts_batch_size) {
        const batch = parsed.data.slice(i, i + posts_batch_size);
        set_upload_status({
          type: 'success',
          message: `Processing posts... ${Math.min(i + posts_batch_size, parsed.data.length)}/${parsed.data.length}${total_new > 0 ? ` (${total_new} new)` : ''}`
        });

        const posts_res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batch_type: 'posts_batch',
            posts: batch
          })
        });

        const posts_result = await posts_res.json();
        if (!posts_result.success) {
          throw new Error(posts_result.error || 'Failed to upload posts');
        }
        total_processed += posts_result.processed || posts_result.count;
        total_new += posts_result.count;
      }

      // Step 3: Extract and upload HTML in batches (only for new posts if incremental)
      const html_entries = zip.file(/posts\/.*\.html$/i);
      const batch_size = 50; // ~50 files per batch to stay under 4.5MB
      let uploaded_html = 0;
      let skipped_html = 0;

      for (let i = 0; i < html_entries.length; i += batch_size) {
        const batch_entries = html_entries.slice(i, i + batch_size);
        const html_batch: Record<string, string> = {};

        for (const entry of batch_entries) {
          const html = await entry.async('text');
          const match = entry.name.match(/posts\/(\d+\.[^/]+)\.html$/i);
          if (match) {
            html_batch[match[1]] = html;
          }
        }

        set_upload_status({
          type: 'success',
          message: `Processing content... ${Math.min(i + batch_size, html_entries.length)}/${html_entries.length}${uploaded_html > 0 ? ` (${uploaded_html} new)` : ''}`
        });

        const html_res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batch_type: 'html_batch',
            html_files: html_batch,
            incremental: !full_reimport
          })
        });

        const html_result = await html_res.json();
        if (!html_result.success) {
          throw new Error(html_result.error || 'Failed to upload HTML batch');
        }
        uploaded_html += html_result.updated || Object.keys(html_batch).length;
        skipped_html += html_result.skipped || 0;
      }

      const summary = full_reimport
        ? `Loaded ${total_new} posts with ${uploaded_html} content files`
        : `Added ${total_new} new posts (${total_processed - total_new} existing skipped)`;

      set_upload_status({
        type: 'success',
        message: summary
      });

      if (date) {
        fetch_posts(date.month, date.day);
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
        {/* Navigation */}
        <NavTabs />

        {/* Page heading */}
        <h1 className="text-center text-3xl font-light text-cyan-400 mb-2">
          On This Day
        </h1>
        <p className="text-center text-xl text-gray-400 mb-4">
          {date?.display || 'Loading...'}
        </p>

        {/* Quick links */}
        <div className="text-center mb-6 flex justify-center gap-4">
          <a
            href="https://8i11.substack.com/publish/posts/drafts"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-cyan-400 transition-colors"
          >
            Drafts ↗
          </a>
          <a
            href="https://8i11.substack.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-cyan-400 transition-colors"
          >
            Substack ↗
          </a>
        </div>

        {/* Archive info */}
        {archive && (
          <p className="text-center text-xs text-gray-400 mb-5">
            Archive: {archive} ({total_posts.toLocaleString()} posts)
          </p>
        )}

        {/* RSS sync status */}
        {sync_status && (
          <p className="text-center text-xs text-cyan-400/70 mb-3 animate-pulse">
            {sync_status}
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
        <div className="creative-quick-actions text-center mb-5 flex flex-col sm:flex-row sm:justify-center gap-3 sm:gap-0">
          <button
            onClick={() => go_to_relative_day(-1)}
            className="creative-secondary-button inline-flex justify-center px-4 sm:px-3 py-2.5 sm:py-1 m-0 sm:m-1 bg-[#333] sm:bg-white/5 border border-[#555] sm:border-transparent rounded-full text-gray-300 sm:text-gray-400 text-sm hover:bg-cyan-400/20 hover:text-cyan-400"
          >
            Yesterday
          </button>
          <button
            onClick={() => go_to_relative_day(0)}
            className="creative-secondary-button inline-flex justify-center px-4 sm:px-3 py-2.5 sm:py-1 m-0 sm:m-1 bg-[#333] sm:bg-white/5 border border-[#555] sm:border-transparent rounded-full text-gray-300 sm:text-gray-400 text-sm hover:bg-cyan-400/20 hover:text-cyan-400"
          >
            Today
          </button>
          <button
            onClick={() => go_to_relative_day(1)}
            className="creative-secondary-button inline-flex justify-center px-4 sm:px-3 py-2.5 sm:py-1 m-0 sm:m-1 bg-[#333] sm:bg-white/5 border border-[#555] sm:border-transparent rounded-full text-gray-300 sm:text-gray-400 text-sm hover:bg-cyan-400/20 hover:text-cyan-400"
          >
            Tomorrow
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-16 text-gray-400">
            <p>Loading...</p>
          </div>
        )}

        {/* Fetch error state */}
        {!loading && fetch_error && (
          <div className="py-10 text-center">
            <div className="inline-block bg-red-900/40 border border-red-500/50 rounded-xl px-6 py-5 max-w-sm">
              <p className="text-red-300 mb-4">{fetch_error}</p>
              <button
                onClick={() => {
                  if (date) {
                    fetch_posts(date.month, date.day);
                  } else {
                    const now = new Date();
                    fetch_posts(now.getMonth() + 1, now.getDate());
                  }
                }}
                className="px-5 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm hover:bg-red-500/40 hover:text-white transition-all"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* No posts state */}
        {!loading && !fetch_error && total_posts === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-5">📦</p>
            <p className="mb-2">No archive loaded</p>
            <p className="text-sm">Upload your Substack export below to get started</p>
          </div>
        )}

        {/* Empty date state */}
        {!loading && !fetch_error && total_posts > 0 && posts.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-5">📭</p>
            <p>No posts found for {date?.display}</p>
          </div>
        )}

        {/* Posts */}
        {!loading && !fetch_error && posts.length > 0 && (
          <>
            <div className="text-center text-6xl font-extralight text-cyan-400 mb-2">
              {posts.length}
            </div>
            <p className="text-center text-gray-400 mb-8">
              post{posts.length !== 1 ? 's' : ''} on this day
            </p>

            {/* Export buttons */}
            <div className="creative-export-actions text-center mb-6 flex flex-col sm:flex-row sm:flex-wrap justify-center gap-3 sm:gap-2">
              <button
                onClick={() => copy_for_substack('simple')}
                className="creative-secondary-button w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-2 border border-[#555] sm:border-cyan-400 rounded-lg bg-[#333] sm:bg-transparent text-cyan-300 sm:text-cyan-400 text-sm font-medium hover:bg-cyan-400 hover:text-[#1a1a2e] transition-all"
              >
                Copy Titles Only
              </button>
              <button
                onClick={() => copy_for_substack('full')}
                className="creative-secondary-button w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-2 border border-[#555] sm:border-cyan-400 rounded-lg bg-[#333] sm:bg-transparent text-cyan-300 sm:text-cyan-400 text-sm font-medium hover:bg-cyan-400 hover:text-[#1a1a2e] transition-all"
              >
                Copy with Blurbs
              </button>
              {has_api_key && (
                <button
                  onClick={copy_with_ai_intro}
                  disabled={ai_copying}
                  className="creative-secondary-button w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-2 border border-[#555] sm:border-purple-400 rounded-lg bg-[#333] sm:bg-transparent text-purple-300 sm:text-purple-400 text-sm font-medium hover:bg-purple-400 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {ai_copying ? 'Writing...' : 'Copy with AI Intro'}
                </button>
              )}
              {copy_status && (
                <span className="text-green-400 text-sm self-center">{copy_status}</span>
              )}
            </div>

            {/* Generate Story button and existing story link */}
            {has_api_key && (
              <div className="text-center mb-8">
                <button
                  onClick={generate_story}
                  disabled={generating}
                  className="creative-primary-button w-full sm:w-auto px-6 py-[14px] sm:py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white font-medium hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? 'Writing...' : existing_story ? 'Regenerate Story' : 'Generate Story'}
                </button>
                {/* Show link to existing story or Archive */}
                <div className="mt-3 flex items-center justify-center gap-4">
                  {(existing_story || story_id) && !generated_story && (
                    <>
                      <a
                        href={`/story/${story_id || existing_story?.id}`}
                        className="text-purple-400 hover:text-purple-300 text-sm"
                      >
                        View saved story →
                      </a>
                      {existing_story && (
                        <span className="text-gray-400 text-xs">
                          (created {new Date(existing_story.created_at).toLocaleDateString()})
                        </span>
                      )}
                    </>
                  )}
                  <a
                    href="/creative/archive"
                    className="text-gray-400 hover:text-cyan-400 text-sm"
                  >
                    Archive →
                  </a>
                </div>
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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                  <h3 className="text-purple-400 font-medium">Generated Story</h3>
                  <div className="creative-story-actions flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-2 w-full sm:w-auto">
                    {token_usage && (
                      <span className="text-xs text-gray-400 mr-2">
                        {token_usage.input + token_usage.output} tokens
                        {token_usage.cached > 0 && ` (${token_usage.cached} cached)`}
                      </span>
                    )}
                    <button
                      onClick={copy_story}
                      className="creative-secondary-button w-full sm:w-auto px-3 py-2.5 sm:py-1 border border-[#555] sm:border-purple-400 rounded bg-[#333] sm:bg-transparent text-purple-300 sm:text-purple-400 text-xs hover:bg-purple-400 hover:text-white transition-all"
                    >
                      Substack
                    </button>
                    <button
                      onClick={copy_story_social}
                      className="creative-secondary-button w-full sm:w-auto px-3 py-2.5 sm:py-1 border border-[#555] sm:border-cyan-400 rounded bg-[#333] sm:bg-transparent text-cyan-300 sm:text-cyan-400 text-xs hover:bg-cyan-400 hover:text-[#1a1a2e] transition-all"
                    >
                      Social
                    </button>
                    <button
                      onClick={copy_story_markdown}
                      className="creative-secondary-button w-full sm:w-auto px-3 py-2.5 sm:py-1 border border-[#555] sm:border-gray-400 rounded bg-[#333] sm:bg-transparent text-gray-300 sm:text-gray-400 text-xs hover:bg-gray-400 hover:text-[#1a1a2e] transition-all"
                    >
                      Markdown
                    </button>
                    {story_id && (
                      <>
                        <a
                          href={`/story/${story_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="creative-secondary-button w-full sm:w-auto px-3 py-2.5 sm:py-1 border border-[#555] sm:border-green-400 rounded bg-[#333] sm:bg-transparent text-green-300 sm:text-green-400 text-xs hover:bg-green-400 hover:text-[#1a1a2e] transition-all inline-block"
                        >
                          View Page
                        </a>
                        <button
                          onClick={copy_story_link}
                          className="creative-secondary-button w-full sm:w-auto px-3 py-2.5 sm:py-1 border border-[#555] sm:border-green-400 rounded bg-[#333] sm:bg-transparent text-green-300 sm:text-green-400 text-xs hover:bg-green-400 hover:text-[#1a1a2e] transition-all"
                        >
                          Copy Link
                        </button>
                      </>
                    )}
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

            {/* Copy preview or Post cards */}
            {copy_preview ? (
              <div className="mb-4">
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => set_copy_preview(null)}
                    className="text-gray-400 hover:text-cyan-400 text-sm"
                  >
                    ← Show posts
                  </button>
                </div>
                <div
                  className="bg-white/5 rounded-xl p-6 border border-cyan-400/30 prose prose-invert prose-sm max-w-none [&_a]:text-cyan-400 [&_a]:no-underline [&_a:hover]:underline"
                  dangerouslySetInnerHTML={{ __html: copy_preview }}
                />
              </div>
            ) : posts.map((post) => (
              <div
                key={post.post_id}
                className="bg-white/5 rounded-xl p-5 mb-4 border border-white/10 hover:translate-x-1 hover:border-cyan-400 transition-all"
              >
                <span className="inline-block bg-cyan-400 text-[#1a1a2e] px-3 py-1 rounded-full text-sm font-semibold mb-2">
                  {post.year}
                </span>
                <span className="text-gray-400 text-sm ml-3">
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


        {/* Upload section */}
        <div className="mt-10 pt-5 border-t border-white/10">
          <details className="text-center">
            <summary className="cursor-pointer text-gray-400 text-sm hover:text-cyan-400">
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
              <p className="text-gray-400 mb-4">Upload a new Substack export (.zip)</p>
              <div className="mb-4">
                <input
                  type="file"
                  accept=".zip"
                  onChange={handle_upload}
                  disabled={uploading}
                  className="text-gray-400 mr-3"
                />
                {uploading && <span className="text-cyan-400">Processing...</span>}
              </div>
              <label className="flex items-center justify-center gap-2 text-sm text-gray-400 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={full_reimport}
                  onChange={(e) => set_full_reimport(e.target.checked)}
                  disabled={uploading}
                  className="rounded"
                />
                Full reimport (clear existing posts first)
              </label>
              <p className="text-xs text-gray-400 mt-4">
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
        <style jsx>{`
          @media (max-width: 768px) {
            .creative-export-actions > span,
            .creative-story-actions > span {
              text-align: center;
              width: 100%;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
