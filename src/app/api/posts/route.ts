/**
 * API route: GET /api/posts
 * Returns posts for a specific month/day across all years
 */

import { NextRequest, NextResponse } from 'next/server';
import { get_posts_on_date, get_archive_info, get_post_count, get_post_url } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date_param = searchParams.get('date');

  let month: number;
  let day: number;

  if (date_param && /^\d{1,2}-\d{1,2}$/.test(date_param)) {
    const [m, d] = date_param.split('-').map(Number);
    month = m;
    day = d;
  } else {
    const now = new Date();
    month = now.getMonth() + 1;
    day = now.getDate();
  }

  // Format display date
  const display_date = new Date(2000, month - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  });

  try {
    const posts = get_posts_on_date(month, day);
    const archive = get_archive_info();
    const total_posts = get_post_count();

    // Add URLs to posts
    const posts_with_urls = posts.map(post => ({
      ...post,
      url: get_post_url(post.post_id)
    }));

    return NextResponse.json({
      date: { month, day, display: display_date },
      posts: posts_with_urls,
      archive: archive?.filename || null,
      total_posts
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts', date: { month, day, display: display_date }, posts: [], total_posts: 0 },
      { status: 500 }
    );
  }
}
