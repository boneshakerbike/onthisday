/**
 * Public story page - shareable without authentication
 * Route: /story/[id]
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { get_story } from '@/lib/db';
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
            <ShareButton storyId={id} />
          </footer>
        </div>
      </div>
    </>
  );
}
