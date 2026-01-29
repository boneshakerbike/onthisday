/**
 * API route: GET /api/sync
 * Fetches RSS feed from Substack and adds any missing posts to the database
 */

import { NextResponse } from 'next/server';
import { get_all_post_ids, add_post_from_rss } from '@/lib/db';

interface RssPost {
  post_id: string;
  title: string;
  url: string;
  post_date: string;
  content_html: string;
}

/**
 * Parse RSS XML and extract posts
 */
function parse_rss(xml: string): RssPost[] {
  const posts: RssPost[] = [];

  // Match all <item> elements
  const item_regex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = item_regex.exec(xml)) !== null) {
    const item = match[1];

    // Extract fields
    const title_match = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                        item.match(/<title>(.*?)<\/title>/);
    const link_match = item.match(/<link>(.*?)<\/link>/);
    const pub_date_match = item.match(/<pubDate>(.*?)<\/pubDate>/);
    const content_match = item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/);

    if (title_match && link_match && pub_date_match) {
      const url = link_match[1].trim();

      // Extract post_id from URL (e.g., "my-post-title" from "https://8i11.substack.com/p/my-post-title")
      const url_match = url.match(/\/p\/([^/?]+)/);
      const post_id = url_match ? url_match[1] : null;

      if (post_id) {
        posts.push({
          post_id,
          title: title_match[1].trim(),
          url,
          post_date: pub_date_match[1].trim(),
          content_html: content_match ? content_match[1] : ''
        });
      }
    }
  }

  return posts;
}

export async function GET() {
  try {
    // Fetch RSS feed
    const rss_url = 'https://8i11.substack.com/feed';
    const response = await fetch(rss_url, {
      headers: {
        'User-Agent': 'OnThisDay/1.0 (RSS Sync)'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS: ${response.status}`);
    }

    const xml = await response.text();
    const rss_posts = parse_rss(xml);

    if (rss_posts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No posts found in RSS feed',
        added: 0,
        checked: 0
      });
    }

    // Get existing post IDs from database
    const existing_ids = await get_all_post_ids();

    // Build set of slugs (handle both "12345.slug" and "slug" formats)
    const existing_slugs = new Set(
      existing_ids.map(id => {
        const parts = id.split('.', 2);
        return parts[1] || parts[0]; // Get slug part, or whole id if no dot
      })
    );

    // Find missing posts (compare by slug to avoid format mismatch)
    const missing_posts = rss_posts.filter(p => !existing_slugs.has(p.post_id));

    // Add missing posts to database
    let added = 0;
    for (const post of missing_posts) {
      try {
        await add_post_from_rss(post);
        added++;
      } catch (err) {
        console.error(`Failed to add post ${post.post_id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      message: added > 0 ? `Added ${added} new post${added > 1 ? 's' : ''}` : 'Up to date',
      added,
      checked: rss_posts.length
    });

  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
