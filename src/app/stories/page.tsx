/**
 * Stories Management Page
 * List, copy, and manage all generated stories
 */

'use client';

import { useState, useEffect } from 'react';
import NavTabs from '@/components/nav_tabs';

interface Story {
  id: string;
  date_key: string;
  date_display: string;
  content: string;
  post_count: number;
  created_at: string;
}

export default function StoriesPage() {
  const [is_localhost, set_is_localhost] = useState(false);
  const [stories, set_stories] = useState<Story[]>([]);
  const [loading, set_loading] = useState(true);
  const [copy_status, set_copy_status] = useState<string | null>(null);
  const [deleting, set_deleting] = useState<string | null>(null);

  useEffect(() => {
    set_is_localhost(window.location.hostname === 'localhost');
    fetch_stories();
  }, []);

  const fetch_stories = async () => {
    try {
      const res = await fetch('/api/stories');
      const data = await res.json();
      if (data.success) {
        set_stories(data.stories);
      }
    } catch (error) {
      console.error('Error fetching stories:', error);
    }
    set_loading(false);
  };

  const extract_title = (content: string): string => {
    const match = content.match(/<h2[^>]*>([^<]+)<\/h2>/i);
    return match ? match[1] : 'Untitled';
  };

  const copy_story = async (story: Story, format: 'substack' | 'social' | 'markdown') => {
    try {
      if (format === 'substack') {
        const blob = new Blob([story.content], { type: 'text/html' });
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
        set_copy_status('Copied for Substack!');
      } else if (format === 'social') {
        // Short format for social (~280 chars max)
        const title = extract_title(story.content);
        const story_url = `${window.location.origin}/story/${story.id}`;
        const text = `${title}\n\n${story.date_display} - ${story.post_count} post${story.post_count !== 1 ? 's' : ''} from my journal.\n\n${story_url}`;
        await navigator.clipboard.writeText(text);
        set_copy_status('Copied for Social!');
      } else {
        let md = story.content;
        md = md.replace(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi, '[$2]($1)');
        md = md.replace(/<h1[^>]*>([^<]+)<\/h1>/gi, '# $1\n\n');
        md = md.replace(/<h2[^>]*>([^<]+)<\/h2>/gi, '## $1\n\n');
        md = md.replace(/<h3[^>]*>([^<]+)<\/h3>/gi, '### $1\n\n');
        md = md.replace(/<\/p>/gi, '\n\n');
        md = md.replace(/<p[^>]*>/gi, '');
        md = md.replace(/<[^>]+>/g, '');
        md = md.replace(/\n{3,}/g, '\n\n').trim();
        const temp = document.createElement('div');
        temp.innerHTML = md;
        md = temp.textContent || md;
        await navigator.clipboard.writeText(md);
        set_copy_status('Copied as Markdown!');
      }
    } catch {
      set_copy_status('Copy failed');
    }
    setTimeout(() => set_copy_status(null), 3000);
  };

  const delete_story = async (id: string) => {
    if (!confirm('Delete this story? This cannot be undone.')) return;

    set_deleting(id);
    try {
      const res = await fetch('/api/stories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        set_stories(stories.filter(s => s.id !== id));
      }
    } catch (error) {
      console.error('Error deleting story:', error);
    }
    set_deleting(null);
  };

  const format_date = (iso: string): string => {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-gray-200 p-5">
      <div className="max-w-3xl mx-auto">
        {/* Navigation */}
        <NavTabs is_localhost={is_localhost} />

        {/* Page heading */}
        <h1 className="text-center text-3xl font-light text-cyan-400 mb-2">
          Your Stories
        </h1>
        <p className="text-center text-gray-500 mb-8">
          {loading ? 'Loading...' : `${stories.length} generated ${stories.length === 1 ? 'story' : 'stories'}`}
        </p>

        {/* Copy status toast */}
        {copy_status && (
          <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
            {copy_status}
          </div>
        )}

        {/* Empty state */}
        {!loading && stories.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-5xl mb-5">📝</p>
            <p className="mb-2">No stories yet</p>
            <p className="text-sm">Generate a story from the On This Day page</p>
          </div>
        )}

        {/* Stories list */}
        {!loading && stories.length > 0 && (
          <div className="space-y-4">
            {stories.map((story) => (
              <div
                key={story.id}
                className="bg-white/5 rounded-xl p-5 border border-white/10 hover:border-cyan-400/50 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  {/* Left: Story info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-cyan-400 text-[#1a1a2e] px-3 py-1 rounded-full text-sm font-semibold">
                        {story.date_display}
                      </span>
                      <span className="text-gray-500 text-sm">
                        {story.post_count} post{story.post_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <h2 className="text-lg text-white mb-1 truncate">
                      {extract_title(story.content)}
                    </h2>
                    <p className="text-gray-500 text-xs">
                      Created {format_date(story.created_at)}
                    </p>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/story/${story.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 border border-cyan-400 rounded text-cyan-400 text-xs hover:bg-cyan-400 hover:text-[#1a1a2e] transition-all"
                    >
                      View
                    </a>
                    <button
                      onClick={() => copy_story(story, 'substack')}
                      className="px-3 py-1 border border-purple-400 rounded text-purple-400 text-xs hover:bg-purple-400 hover:text-white transition-all"
                    >
                      Substack
                    </button>
                    <button
                      onClick={() => copy_story(story, 'social')}
                      className="px-3 py-1 border border-gray-400 rounded text-gray-400 text-xs hover:bg-gray-400 hover:text-[#1a1a2e] transition-all"
                    >
                      Social
                    </button>
                    <button
                      onClick={() => copy_story(story, 'markdown')}
                      className="px-3 py-1 border border-gray-400 rounded text-gray-400 text-xs hover:bg-gray-400 hover:text-[#1a1a2e] transition-all"
                    >
                      MD
                    </button>
                    <button
                      onClick={() => delete_story(story.id)}
                      disabled={deleting === story.id}
                      className="px-3 py-1 border border-red-400/50 rounded text-red-400/70 text-xs hover:bg-red-400 hover:text-white hover:border-red-400 transition-all disabled:opacity-50"
                    >
                      {deleting === story.id ? '...' : '×'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
