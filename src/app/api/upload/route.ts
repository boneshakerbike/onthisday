/**
 * API route: POST /api/upload
 * Receives parsed CSV data and HTML content from client-side zip extraction
 * Supports batched uploads to work within Vercel's payload limits
 */

import { NextRequest, NextResponse } from 'next/server';
import { import_posts, set_archive_info, get_post_count, update_post_html } from '@/lib/db';

interface UploadPayload {
  filename?: string;
  batch_type: 'full' | 'posts_only' | 'html_batch';
  posts?: Array<{
    post_id: string;
    title: string;
    subtitle?: string;
    post_date: string;
    audience?: string;
    type?: string;
  }>;
  html_files?: Record<string, string>;
}

export async function POST(request: NextRequest) {
  try {
    const data: UploadPayload = await request.json();
    const batch_type = data.batch_type || 'full';

    if (batch_type === 'posts_only' || batch_type === 'full') {
      // Import posts (with or without HTML)
      if (!data.posts || !Array.isArray(data.posts)) {
        return NextResponse.json(
          { error: 'Invalid data: posts array required' },
          { status: 400 }
        );
      }

      const html_map = new Map<string, string>();
      if (batch_type === 'full' && data.html_files) {
        for (const [post_id, html] of Object.entries(data.html_files)) {
          html_map.set(post_id, html);
        }
      }

      const count = await import_posts(data.posts, html_map);

      if (data.filename) {
        await set_archive_info(data.filename);
      }

      return NextResponse.json({
        success: true,
        message: `Imported ${count} posts`,
        count,
        total: await get_post_count()
      });

    } else if (batch_type === 'html_batch') {
      // Update HTML content for existing posts
      if (!data.html_files) {
        return NextResponse.json(
          { error: 'Invalid data: html_files required for html_batch' },
          { status: 400 }
        );
      }

      let updated = 0;
      for (const [post_id, html] of Object.entries(data.html_files)) {
        await update_post_html(post_id, html);
        updated++;
      }

      return NextResponse.json({
        success: true,
        message: `Updated ${updated} posts with HTML`,
        updated,
        total: await get_post_count()
      });
    }

    return NextResponse.json(
      { error: 'Invalid batch_type' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to import data' },
      { status: 500 }
    );
  }
}
