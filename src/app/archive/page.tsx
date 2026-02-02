/**
 * Archive page - browse all generated stories
 * Public: clean read-only view
 * Authenticated: shows copy/delete management features
 * Route: /archive
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import NavTabs from '@/components/nav_tabs';

interface Story {
  id: string;
  date_key: string;
  date_display: string;
  content: string;
  post_count: number;
  image_url: string | null;
  created_at: string;
}

type SortOrder = 'date_asc' | 'date_desc' | 'created_asc' | 'created_desc';

// Group stories by month (respects sort order)
function group_by_month(stories: Story[], sort_order: SortOrder) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const grouped: Record<string, Story[]> = {};

  for (const story of stories) {
    const month_num = parseInt(story.date_key.split('-')[0], 10);
    const month_name = months[month_num - 1];
    if (!grouped[month_name]) {
      grouped[month_name] = [];
    }
    grouped[month_name].push(story);
  }

  // For created_at sorting, don't group - return all in one "group"
  if (sort_order.startsWith('created_')) {
    return [{ month: '', stories }];
  }

  // For date sorting, order months according to sort direction
  let ordered_months = months.filter(m => grouped[m]?.length > 0);
  if (sort_order === 'date_desc') {
    ordered_months = ordered_months.reverse();
  }

  return ordered_months.map(month => ({ month, stories: grouped[month] }));
}

export default function ArchivePage() {
  const { data: session, status } = useSession();
  const is_authenticated = status === 'authenticated';
  const is_loading_auth = status === 'loading';

  const [stories, set_stories] = useState<Story[]>([]);
  const [loading, set_loading] = useState(true);
  const [copy_status, set_copy_status] = useState<string | null>(null);
  const [deleting, set_deleting] = useState<string | null>(null);
  const [sort_order, set_sort_order] = useState<SortOrder>('date_asc');

  useEffect(() => {
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

  const sorted_stories = useMemo(() => {
    const sorted = [...stories];
    switch (sort_order) {
      case 'date_asc':
        return sorted.sort((a, b) => a.date_key.localeCompare(b.date_key));
      case 'date_desc':
        return sorted.sort((a, b) => b.date_key.localeCompare(a.date_key));
      case 'created_asc':
        return sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
      case 'created_desc':
        return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
      default:
        return sorted;
    }
  }, [stories, sort_order]);

  const grouped = useMemo(() => group_by_month(sorted_stories, sort_order), [sorted_stories, sort_order]);

  const get_title = (content: string, date_display: string): string => {
    const match = content.match(/<h2[^>]*>([^<]+)<\/h2>/i);
    return match ? match[1] : `Reflections on ${date_display}`;
  };

  const copy_story = async (story: Story, format: 'substack' | 'social' | 'markdown') => {
    try {
      if (format === 'substack') {
        const blob = new Blob([story.content], { type: 'text/html' });
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
        set_copy_status('Copied for Substack!');
      } else if (format === 'social') {
        const story_url = `${window.location.origin}/story/${story.id}`;
        const text = `On This Day: ${story.date_display}\n\n${story.post_count} post${story.post_count !== 1 ? 's' : ''} from my journal.\n\n${story_url}`;
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

  if (loading || is_loading_auth) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: base_styles }} />
        <div className="archive-page">
          <div className="archive-container">
            <header className="archive-header">
              <h1 className="archive-title">On This Day</h1>
              <p className="archive-subtitle">Loading...</p>
            </header>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: base_styles + (is_authenticated ? admin_styles : '') }} />
      <div className="archive-page">
        <div className="archive-container">
          {/* Navigation for logged-in users */}
          {is_authenticated && (
            <NavTabs theme="light" />
          )}
          {/* Copy status toast */}
          {copy_status && (
            <div className="toast">{copy_status}</div>
          )}

          <header className="archive-header">
            <h1 className="archive-title">On This Day</h1>
            <p className="archive-subtitle">
              {stories.length} {stories.length === 1 ? 'story' : 'stories'} across the calendar
            </p>
          </header>

          {/* Sort controls for authenticated users */}
          {is_authenticated && stories.length > 1 && (
            <div className="sort-controls">
              <span className="sort-label">Sort:</span>
              <button
                onClick={() => set_sort_order(sort_order === 'date_asc' ? 'date_desc' : 'date_asc')}
                className={`sort-btn ${sort_order.startsWith('date_') ? 'active' : ''}`}
              >
                Date {sort_order === 'date_asc' ? '↑' : sort_order === 'date_desc' ? '↓' : ''}
              </button>
              <button
                onClick={() => set_sort_order(sort_order === 'created_desc' ? 'created_asc' : 'created_desc')}
                className={`sort-btn ${sort_order.startsWith('created_') ? 'active' : ''}`}
              >
                Created {sort_order === 'created_asc' ? '↑' : sort_order === 'created_desc' ? '↓' : ''}
              </button>
            </div>
          )}

          {stories.length === 0 ? (
            <div className="empty-state">
              <p>No stories yet.</p>
              <p>Stories will appear here once they are generated.</p>
            </div>
          ) : (
            grouped.map(({ month, stories: month_stories }) => (
              <section key={month || 'all'} className="month-section">
                {month && (
                  <h2 className="month-title">
                    {month}
                    <span className="story-count">{month_stories.length}</span>
                  </h2>
                )}
                <ul className="story-list">
                  {month_stories.map((story) => (
                    <li key={story.id} className="story-item">
                      <Link href={`/story/${story.id}`} className="story-link">
                        <div className="story-date">{story.date_display}</div>
                        <h3 className="story-title-text">
                          {get_title(story.content, story.date_display)}
                        </h3>
                        <div className="story-meta">
                          {story.post_count} {story.post_count === 1 ? 'moment' : 'moments'} across the years
                        </div>
                      </Link>

                      {/* Admin actions */}
                      {is_authenticated && (
                        <div className="admin-actions">
                          <button onClick={() => copy_story(story, 'substack')} className="action-btn substack">
                            Substack
                          </button>
                          <button onClick={() => copy_story(story, 'social')} className="action-btn social">
                            Social
                          </button>
                          <button onClick={() => copy_story(story, 'markdown')} className="action-btn md">
                            MD
                          </button>
                          <button
                            onClick={() => delete_story(story.id)}
                            disabled={deleting === story.id}
                            className="action-btn delete"
                          >
                            {deleting === story.id ? '...' : '×'}
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}

          <footer className="archive-footer">
            <p>
              <a
                href="https://8i11.substack.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                William Martin Journal
              </a>
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}

const base_styles = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500&display=swap');

  .archive-page {
    min-height: 100vh;
    background: linear-gradient(180deg, #faf8f5 0%, #f5f0e8 100%);
    color: #37352f;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    margin: 0;
    padding: 0;
  }

  .archive-container {
    max-width: 720px;
    margin: 0 auto;
    padding: 60px 24px 80px;
  }

  .archive-header {
    margin-bottom: 48px;
    text-align: center;
  }

  .archive-title {
    font-family: 'Lora', Georgia, serif;
    font-size: 2.5em;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 16px 0;
    line-height: 1.2;
    letter-spacing: -0.02em;
  }

  .archive-subtitle {
    font-size: 1.1em;
    color: #7c7c7c;
    font-style: italic;
    margin: 0;
  }

  .back-link {
    display: inline-block;
    margin-top: 16px;
    font-size: 0.9em;
    color: #7c7c7c;
    text-decoration: none;
  }

  .back-link:hover {
    color: #c4704b;
  }

  .month-section {
    margin-bottom: 48px;
  }

  .month-title {
    font-family: 'Lora', Georgia, serif;
    font-size: 1.4em;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 20px 0;
    padding-bottom: 12px;
    border-bottom: 1px solid #e5e0d8;
  }

  .story-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .story-item {
    margin-bottom: 16px;
  }

  .story-link {
    display: block;
    padding: 16px 20px;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 8px;
    text-decoration: none;
    color: inherit;
    transition: all 0.2s ease;
    border: 1px solid transparent;
  }

  .story-link:hover {
    background: rgba(255, 255, 255, 0.9);
    border-color: #c4704b40;
    transform: translateX(4px);
  }

  .story-date {
    font-size: 0.85em;
    color: #c4704b;
    font-weight: 500;
    margin-bottom: 4px;
  }

  .story-title-text {
    font-family: 'Lora', Georgia, serif;
    font-size: 1.15em;
    font-weight: 500;
    color: #1a1a1a;
    margin: 0 0 6px 0;
  }

  .story-meta {
    font-size: 0.85em;
    color: #9c9c9c;
  }

  .archive-footer {
    margin-top: 64px;
    padding-top: 32px;
    border-top: 1px solid #e5e0d8;
    text-align: center;
    font-size: 0.9em;
    color: #9c9c9c;
  }

  .archive-footer a {
    color: #7c7c7c;
    text-decoration: none;
  }

  .archive-footer a:hover {
    color: #c4704b;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #9c9c9c;
  }

  .empty-state p {
    margin: 0 0 8px 0;
  }

  .story-count {
    background: #f5f0e8;
    color: #7c7c7c;
    font-size: 0.55em;
    padding: 2px 8px;
    border-radius: 12px;
    margin-left: 8px;
    font-weight: 400;
    vertical-align: middle;
  }

  .toast {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4a9c6d;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 0.9em;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }

`;

const admin_styles = `
  .sort-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    margin-bottom: 32px;
  }

  .sort-label {
    font-size: 0.85em;
    color: #9c9c9c;
    margin-right: 4px;
  }

  .sort-btn {
    padding: 6px 12px;
    background: transparent;
    border: 1px solid #d4d4d4;
    border-radius: 6px;
    font-size: 0.8em;
    color: #7c7c7c;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .sort-btn:hover {
    border-color: #c4704b;
    color: #c4704b;
  }

  .sort-btn.active {
    background: #c4704b15;
    border-color: #c4704b;
    color: #c4704b;
  }

  .admin-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #e5e0d8;
  }

  .action-btn {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.75em;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid;
  }

  .action-btn.substack {
    background: transparent;
    border-color: #7c3aed;
    color: #7c3aed;
  }

  .action-btn.substack:hover {
    background: #7c3aed;
    color: white;
  }

  .action-btn.social,
  .action-btn.md {
    background: transparent;
    border-color: #9c9c9c;
    color: #9c9c9c;
  }

  .action-btn.social:hover,
  .action-btn.md:hover {
    background: #9c9c9c;
    color: white;
  }

  .action-btn.delete {
    background: transparent;
    border-color: #e5534b50;
    color: #e5534b80;
  }

  .action-btn.delete:hover {
    background: #e5534b;
    border-color: #e5534b;
    color: white;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
