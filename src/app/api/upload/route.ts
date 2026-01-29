/**
 * API route: POST /api/upload
 * Receives parsed CSV data and HTML content from client-side zip extraction
 * Supports batched uploads to work within Vercel's payload limits
 */

import { NextRequest, NextResponse } from 'next/server';
import { clear_posts, append_posts, set_archive_info, get_post_count, update_post_html } from '@/lib/db';

interface UploadPayload {
  filename?: string;
  batch_type: 'clear' | 'init' | 'posts_batch' | 'html_batch';
  incremental?: boolean;
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
    const batch_type = data.batch_type;

    if (batch_type === 'clear') {
      // Clear all posts and set archive info
      await clear_posts();
      if (data.filename) {
        await set_archive_info(data.filename);
      }
      return NextResponse.json({
        success: true,
        message: 'Cleared posts'
      });

    } else if (batch_type === 'init') {
      // Set archive info without clearing (for incremental import)
      if (data.filename) {
        await set_archive_info(data.filename);
      }
      return NextResponse.json({
        success: true,
        message: 'Initialized for incremental import'
      });

    } else if (batch_type === 'posts_batch') {
      // Append posts (skips existing with INSERT OR IGNORE)
      if (!data.posts || !Array.isArray(data.posts)) {
        return NextResponse.json(
          { error: 'Invalid data: posts array required' },
          { status: 400 }
        );
      }

      const result = await append_posts(data.posts, new Map());

      return NextResponse.json({
        success: true,
        message: `Processed ${result.processed} posts, ${result.inserted} new`,
        count: result.inserted,
        processed: result.processed,
        total: await get_post_count()
      });

    } else if (batch_type === 'html_batch') {
      // Update HTML content for posts
      // If incremental=true, only update posts that don't have HTML yet
      if (!data.html_files) {
        return NextResponse.json(
          { error: 'Invalid data: html_files required for html_batch' },
          { status: 400 }
        );
      }

      const only_if_empty = data.incremental === true;
      let updated = 0;
      let skipped = 0;

      for (const [post_id, html] of Object.entries(data.html_files)) {
        const was_updated = await update_post_html(post_id, html, only_if_empty);
        if (was_updated) {
          updated++;
        } else {
          skipped++;
        }
      }

      return NextResponse.json({
        success: true,
        message: only_if_empty
          ? `Updated ${updated} posts, skipped ${skipped} (already have content)`
          : `Updated ${updated} posts with HTML`,
        updated,
        skipped,
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
