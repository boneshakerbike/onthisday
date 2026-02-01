/**
 * Public story page - shareable without authentication
 * Route: /story/[id]
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { get_story, get_adjacent_stories } from '@/lib/db';
import ShareButton from './share_button';

interface PageProps {
  params: Promise<{ id: string }>;
}

// Generate metadata for social sharing
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const story = await get_story(id);

  if (!story) {
    return { title: 'Story Not Found' };
  }

  // Extract title from story HTML (looks for <h2>...</h2>)
  const title_match = story.content.match(/<h2[^>]*>([^<]+)<\/h2>/i);
  const title = title_match ? title_match[1] : `On This Day: ${story.date_display}`;

  // Extract first paragraph as description
  const desc_match = story.content.match(/<p[^>]*>([^<]+)<\/p>/i);
  const description = desc_match
    ? desc_match[1].substring(0, 160) + (desc_match[1].length > 160 ? '...' : '')
    : `A reflection on ${story.post_count} posts from ${story.date_display}`;

  const metadata: Metadata = {
    title: `${title} | On This Day`,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime: story.created_at,
      siteName: 'On This Day',
    },
    twitter: {
      card: story.image_url ? 'summary_large_image' : 'summary',
      title,
      description,
    },
  };

  // Add image to OpenGraph if available
  if (story.image_url) {
    metadata.openGraph = {
      ...metadata.openGraph,
      images: [{ url: story.image_url }],
    };
    metadata.twitter = {
      ...metadata.twitter,
      images: [story.image_url],
    };
  }

  return metadata;
}

export default async function StoryPage({ params }: PageProps) {
  const { id } = await params;
  const story = await get_story(id);

  if (!story) {
    notFound();
  }

  // Get prev/next stories for navigation
  const { prev, next } = await get_adjacent_stories(story.date_key);

  // Extract title from story HTML (looks for <h2>...</h2>)
  const title_match = story.content.match(/<h2[^>]*>([^<]+)<\/h2>/i);
  const title = title_match ? title_match[1] : `Reflections on ${story.date_display}`;

  // Remove the h2 from content since we're displaying it separately
  const body_content = story.content.replace(/<h2[^>]*>[^<]+<\/h2>/i, '').trim();

  const created_date = new Date(story.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Creative subtitle based on post count
  const years_text = story.post_count === 1
    ? 'a moment'
    : `${story.post_count} moments`;
  const subtitle = `${years_text} from ${story.date_display}, across the years`;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500&display=swap');

            .story-page {
              min-height: 100vh;
              background: linear-gradient(180deg, #faf8f5 0%, #f5f0e8 100%);
              color: #37352f;
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              margin: 0;
              padding: 0;
            }

            .story-container {
              max-width: 680px;
              margin: 0 auto;
              padding: 60px 24px 80px;
            }

            .story-header {
              margin-bottom: 48px;
              text-align: center;
            }

            .story-title {
              font-family: 'Lora', Georgia, serif;
              font-size: 2.5em;
              font-weight: 600;
              color: #1a1a1a;
              margin: 0 0 16px 0;
              line-height: 1.2;
              letter-spacing: -0.02em;
            }

            .story-subtitle {
              font-size: 1.1em;
              color: #7c7c7c;
              font-style: italic;
              margin: 0;
            }

            .story-body {
              font-size: 1.125em;
              line-height: 1.8;
              color: #37352f;
            }

            .story-body p {
              margin: 0 0 1.5em 0;
            }

            .story-body a {
              color: #c4704b;
              text-decoration: none;
              border-bottom: 1px solid #c4704b40;
              transition: border-color 0.2s ease;
            }

            .story-body a:hover {
              border-bottom-color: #c4704b;
            }

            .story-footer {
              margin-top: 64px;
              padding-top: 32px;
              border-top: 1px solid #e5e0d8;
              text-align: center;
              font-size: 0.9em;
              color: #9c9c9c;
            }

            .story-footer a {
              color: #7c7c7c;
              text-decoration: none;
            }

            .story-footer a:hover {
              color: #c4704b;
            }

            .footer-brand {
              margin-top: 16px;
            }

            .footer-divider {
              margin: 0 8px;
              color: #d4d4d4;
            }

            .story-nav {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 32px;
              padding-top: 24px;
              border-top: 1px solid #e5e0d8;
            }

            .nav-link {
              display: flex;
              flex-direction: column;
              text-decoration: none;
              color: #7c7c7c;
              transition: color 0.2s ease;
              max-width: 45%;
            }

            .nav-link:hover {
              color: #c4704b;
            }

            .nav-link.prev {
              align-items: flex-start;
            }

            .nav-link.next {
              align-items: flex-end;
              text-align: right;
            }

            .nav-label {
              font-size: 0.75em;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 4px;
              opacity: 0.7;
            }

            .nav-date {
              font-family: 'Lora', Georgia, serif;
              font-size: 1em;
              color: inherit;
            }

            .nav-spacer {
              flex: 1;
            }

            .archive-link {
              display: inline-block;
              margin-top: 16px;
              font-size: 0.85em;
              color: #7c7c7c;
              text-decoration: none;
              transition: color 0.2s ease;
            }

            .archive-link:hover {
              color: #c4704b;
            }

            .story-image {
              width: 100%;
              max-height: 400px;
              object-fit: cover;
              border-radius: 12px;
              margin-bottom: 40px;
            }
          `,
        }}
      />
      <div className="story-page">
        <div className="story-container">
          {/* Header with title as hero */}
          <header className="story-header">
            <h1 className="story-title">{title}</h1>
            <p className="story-subtitle">{subtitle}</p>
          </header>

          {/* Featured image from source posts */}
          {story.image_url && (
            <img
              src={story.image_url}
              alt=""
              className="story-image"
              loading="lazy"
            />
          )}

          {/* Story content */}
          <article
            className="story-body"
            dangerouslySetInnerHTML={{ __html: body_content }}
          />

          {/* Navigation between stories */}
          {(prev || next) && (
            <nav className="story-nav">
              {prev ? (
                <Link href={`/story/${prev.id}`} className="nav-link prev">
                  <span className="nav-label">Previous</span>
                  <span className="nav-date">{prev.date_display}</span>
                </Link>
              ) : (
                <div className="nav-spacer" />
              )}
              {next ? (
                <Link href={`/story/${next.id}`} className="nav-link next">
                  <span className="nav-label">Next</span>
                  <span className="nav-date">{next.date_display}</span>
                </Link>
              ) : (
                <div className="nav-spacer" />
              )}
            </nav>
          )}

          {/* Minimal footer */}
          <footer className="story-footer">
            <p>Generated {created_date}</p>
            <p className="footer-brand">
              <a
                href="https://8i11.substack.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                William Martin Journal
              </a>
            </p>
            <Link href="/archive" className="archive-link">
              Browse all stories
            </Link>
            <ShareButton storyId={id} />
          </footer>
        </div>
      </div>
    </>
  );
}
