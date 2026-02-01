/**
 * Public archive page - browse all generated stories
 * Route: /archive
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { get_all_stories } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Archive | On This Day',
  description: 'Browse all On This Day stories - reflections across the years',
  openGraph: {
    title: 'On This Day Archive',
    description: 'Browse all On This Day stories - reflections across the years',
    type: 'website',
    siteName: 'On This Day',
  },
};

// Story type for grouping
interface StoryItem {
  id: string;
  date_key: string;
  date_display: string;
  content: string;
  post_count: number;
  image_url: string | null;
  created_at: string;
}

// Group stories by month
function group_by_month(stories: StoryItem[]) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const grouped: Record<string, StoryItem[]> = {};

  for (const story of stories) {
    const month_num = parseInt(story.date_key.split('-')[0], 10);
    const month_name = months[month_num - 1];
    if (!grouped[month_name]) {
      grouped[month_name] = [];
    }
    grouped[month_name].push(story);
  }

  // Return in month order
  return months
    .filter(m => grouped[m]?.length > 0)
    .map(month => ({ month, stories: grouped[month] }));
}

export default async function ArchivePage() {
  const stories = await get_all_stories();
  const grouped = group_by_month(stories);

  // Extract title from story content
  function get_title(content: string, date_display: string): string {
    const match = content.match(/<h2[^>]*>([^<]+)<\/h2>/i);
    return match ? match[1] : `Reflections on ${date_display}`;
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
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

            .story-title {
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
              font-size: 0.75em;
              padding: 2px 8px;
              border-radius: 12px;
              margin-left: 8px;
            }
          `,
        }}
      />
      <div className="archive-page">
        <div className="archive-container">
          <header className="archive-header">
            <h1 className="archive-title">On This Day</h1>
            <p className="archive-subtitle">
              {stories.length} {stories.length === 1 ? 'story' : 'stories'} across the calendar
            </p>
          </header>

          {stories.length === 0 ? (
            <div className="empty-state">
              <p>No stories yet.</p>
              <p>Stories will appear here once they are generated.</p>
            </div>
          ) : (
            grouped.map(({ month, stories: month_stories }) => (
              <section key={month} className="month-section">
                <h2 className="month-title">
                  {month}
                  <span className="story-count">{month_stories.length}</span>
                </h2>
                <ul className="story-list">
                  {month_stories.map((story) => (
                    <li key={story.id} className="story-item">
                      <Link href={`/story/${story.id}`} className="story-link">
                        <div className="story-date">{story.date_display}</div>
                        <h3 className="story-title">
                          {get_title(story.content, story.date_display)}
                        </h3>
                        <div className="story-meta">
                          {story.post_count} {story.post_count === 1 ? 'moment' : 'moments'} across the years
                        </div>
                      </Link>
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
