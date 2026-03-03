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
  blurb: string;
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

interface SavedStory {
  id: string;
  created_at: string;
  blurb: string | null;
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
  const [existing_story, set_existing_story] = useState<SavedStory | null>(null);
  const [story_copy_status, set_story_copy_status] = useState('');
  const [generate_error, set_generate_error] = useState<string | null>(null);
  const [token_usage, set_token_usage] = useState<{ input: number; output: number; cached: number } | null>(null);


  // Fetch error state (for /api/posts failures)
  const [fetch_error, set_fetch_error] = useState<string | null>(null);

  // RSS sync state
  const [sync_status, set_sync_status] = useState<string | null>(null);

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
            created_at: story_data.story.created_at,
            blurb: story_data.story.blurb || null
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
    const d = offset === 0 || !date
      ? new Date()
      : new Date(new Date().getFullYear(), date.month - 1, date.day);
    if (offset !== 0) {
      d.setDate(d.getDate() + offset);
    }
    fetch_posts(d.getMonth() + 1, d.getDate());
  };

  const copy_for_substack = async (version: 'simple' | 'full') => {
    if (!posts.length || !date) return;
    set_story_copy_status('');

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
            created_at: new Date().toISOString(),
            blurb: data.blurb || null
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

  const copyStoryBlurb = async () => {
    if (!existing_story?.blurb) return;
    set_copy_status('');

    try {
      await navigator.clipboard.writeText(existing_story.blurb);
      set_story_copy_status('Blurb copied!');
    } catch {
      set_story_copy_status('Copy failed');
    }
    setTimeout(() => set_story_copy_status(''), 3000);
  };

  const copy_story_link = async () => {
    const active_story_id = story_id || existing_story?.id;
    if (!active_story_id) return;
    set_copy_status('');

    try {
      const base_url = window.location.origin;
      const link = `${base_url}/story/${active_story_id}`;
      await navigator.clipboard.writeText(link);
      set_story_copy_status('Link copied!');
    } catch {
      set_story_copy_status('Copy failed');
    }
    setTimeout(() => set_story_copy_status(''), 3000);
  };

  const copyStoryShareText = async () => {
    const active_story_id = story_id || existing_story?.id;
    if (!active_story_id || !existing_story?.blurb) return;
    set_copy_status('');

    try {
      const base_url = window.location.origin;
      const link = `${base_url}/story/${active_story_id}`;
      const text = `${existing_story.blurb}\n\nRead more: ${link}`;
      await navigator.clipboard.writeText(text);
      set_story_copy_status('Share text copied!');
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
  const current_story_id = story_id || existing_story?.id || null;
  const current_story_blurb = existing_story?.blurb || null;
  const control_group_class = 'mb-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4';
  const control_label_text_class = 'text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/70';
  const collapsible_summary_class = 'cursor-pointer list-none';
  const collapsible_summary_row_class = 'mb-3 flex items-center justify-between gap-3';
  const action_button_class = 'inline-flex w-full sm:w-auto items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50';
  const secondary_button_class = `${action_button_class} border-cyan-400/30 bg-white/[0.03] text-cyan-200 hover:border-cyan-300 hover:bg-cyan-400/15 hover:text-white`;
  const subtle_button_class = `${action_button_class} border-white/10 bg-transparent text-gray-300 hover:border-cyan-400/30 hover:text-cyan-200`;
  const primary_button_class = `${action_button_class} border-amber-300/50 bg-gradient-to-r from-amber-300 to-orange-300 text-[#16213e] hover:from-amber-200 hover:to-orange-200`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-gray-200 p-5">
      <div className="max-w-3xl mx-auto">
        {/* Navigation */}
        <NavTabs />

        {/* Page heading */}
        <h1 className="text-center text-3xl font-light text-cyan-400 mb-3">
          On This Day{date ? ` — ${date.display}` : ''}
        </h1>
        <div className="mb-5 text-center text-sm text-gray-400">
          {!loading && !fetch_error && posts.length > 0 && (
            <p>
              {posts.length} post{posts.length !== 1 ? 's' : ''} on this day
            </p>
          )}
        </div>

        {/* RSS sync status */}
        {sync_status && (
          <p className="text-center text-xs text-cyan-400/70 mb-3 animate-pulse">
            {sync_status}
          </p>
        )}

        {/* Date navigation */}
        <details className={control_group_class}>
          <summary className={collapsible_summary_class}>
            <div className={collapsible_summary_row_class}>
              <span className={control_label_text_class}>Date Navigation</span>
              <span className="text-xs text-gray-500">Toggle</span>
            </div>
          </summary>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <input
              type="date"
              value={date_input_value}
              onChange={handle_date_change}
              className="w-full sm:w-auto rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-base text-white"
            />
            <button
              onClick={() => go_to_relative_day(-1)}
              className={secondary_button_class}
            >
              Yesterday
            </button>
            <button
              onClick={() => go_to_relative_day(0)}
              className={secondary_button_class}
            >
              Today
            </button>
            <button
              onClick={() => go_to_relative_day(1)}
              className={secondary_button_class}
            >
              Tomorrow
            </button>
          </div>
        </details>

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
            <details className={control_group_class}>
              <summary className={collapsible_summary_class}>
                <div className={collapsible_summary_row_class}>
                  <span className={control_label_text_class}>Export / Copy</span>
                  <span className="text-xs text-gray-500">Toggle</span>
                </div>
              </summary>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  onClick={() => copy_for_substack('simple')}
                  className={secondary_button_class}
                >
                  Copy Titles
                </button>
                <button
                  onClick={() => copy_for_substack('full')}
                  className={secondary_button_class}
                >
                  Copy Titles + Blurbs
                </button>
                {current_story_blurb && (
                  <button
                    onClick={copyStoryBlurb}
                    className={secondary_button_class}
                  >
                    Copy Blurb
                  </button>
                )}
                {current_story_id && (
                  <button
                    onClick={copy_story_link}
                    className={secondary_button_class}
                  >
                    Copy Link
                  </button>
                )}
                {current_story_id && current_story_blurb && (
                  <button
                    onClick={copyStoryShareText}
                    className={secondary_button_class}
                  >
                    Copy Share Text
                  </button>
                )}
              </div>
              {(copy_status || story_copy_status) && (
                <p className="mt-3 text-sm text-green-400">{copy_status || story_copy_status}</p>
              )}
            </details>

            <details className={control_group_class}>
              <summary className={collapsible_summary_class}>
                <div className={collapsible_summary_row_class}>
                  <span className={control_label_text_class}>Story Actions</span>
                  <span className="text-xs text-gray-500">Toggle</span>
                </div>
              </summary>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {has_api_key && (
                  <button
                    onClick={generate_story}
                    disabled={generating}
                    className={primary_button_class}
                  >
                    {generating ? 'Writing...' : existing_story ? 'Regenerate Story' : 'Generate Story'}
                  </button>
                )}
                {current_story_id && (
                  <a
                    href={`/story/${current_story_id}`}
                    className={secondary_button_class}
                  >
                    View Saved Story
                  </a>
                )}
                <a
                  href="/creative/archive"
                  className={subtle_button_class}
                >
                  Archive
                </a>
                <a
                  href="https://8i11.substack.com/publish/posts/drafts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={subtle_button_class}
                >
                  Drafts ↗
                </a>
                <a
                  href="https://8i11.substack.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={subtle_button_class}
                >
                  Substack ↗
                </a>
              </div>
              {existing_story && (
                <p className="mt-3 text-xs text-gray-400">
                  Saved {new Date(existing_story.created_at).toLocaleDateString()}
                </p>
              )}
            </details>

            {/* Generate error */}
            {generate_error && (
              <div className="mb-6 p-4 bg-red-400/10 border border-red-400/30 rounded-lg text-red-400 text-center">
                {generate_error}
              </div>
            )}

            {/* Generated story */}
            {generated_story && (
              <div className="mb-8 p-6 bg-white/5 border border-purple-400/30 rounded-xl">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-purple-400 font-medium">Story Preview</h3>
                  {token_usage && (
                    <span className="text-xs text-gray-400">
                      {token_usage.input + token_usage.output} tokens
                      {token_usage.cached > 0 && ` (${token_usage.cached} cached)`}
                    </span>
                  )}
                </div>
                <div
                  className="prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: generated_story }}
                />
              </div>
            )}

            {current_story_blurb && (
              <div className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                  Saved Blurb
                </p>
                <p className="mt-2 text-sm leading-relaxed text-amber-50">
                  {current_story_blurb}
                </p>
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
              <details
                key={post.post_id}
                className="mb-4 rounded-xl border border-white/10 bg-white/5 transition-all hover:border-cyan-400"
              >
                <summary className="cursor-pointer px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-block rounded-full bg-cyan-400 px-3 py-1 text-sm font-semibold text-[#1a1a2e]">
                      {post.year}
                    </span>
                    <span className="text-sm text-gray-400">
                      {get_years_text(post.years_ago)}
                    </span>
                    <span className="text-lg text-white">{post.title}</span>
                  </div>
                </summary>
                <div className="px-5 pb-5">
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-cyan-300 hover:text-cyan-200"
                  >
                    Open post ↗
                  </a>
                  {post.blurb && (
                    <p className="mt-3 text-sm leading-relaxed text-gray-400">{post.blurb}</p>
                  )}
                </div>
              </details>
            ))}
          </>
        )}

        {/* Upload section */}
        <div className="mt-10 pt-5 border-t border-white/10">
          {archive && (
            <p className="mb-4 text-center text-sm text-gray-400">
              Archive: {archive} ({total_posts.toLocaleString()} posts)
            </p>
          )}
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
      </div>
    </div>
  );
}
