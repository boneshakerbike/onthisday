/**
 * API route: POST /api/upload
 * Receives parsed CSV data and HTML content from client-side zip extraction
 */

import { NextRequest, NextResponse } from 'next/server';
import { import_posts, set_archive_info, get_post_count } from '@/lib/db';

interface UploadPayload {
  filename: string;
  posts: Array<{
    post_id: string;
    title: string;
    subtitle?: string;
    post_date: string;
    audience?: string;
    type?: string;
  }>;
  html_files: Record<string, string>;
}

export async function POST(request: NextRequest) {
  try {
    const data: UploadPayload = await request.json();

    if (!data.posts || !Array.isArray(data.posts)) {
      return NextResponse.json(
        { error: 'Invalid data: posts array required' },
        { status: 400 }
      );
    }

    // Convert html_files object to Map
    const html_map = new Map<string, string>();
    if (data.html_files) {
      for (const [post_id, html] of Object.entries(data.html_files)) {
        html_map.set(post_id, html);
      }
    }

    // Import posts to database
    const count = import_posts(data.posts, html_map);

    // Update archive info
    if (data.filename) {
      set_archive_info(data.filename);
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${count} posts`,
      count,
      total: get_post_count()
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to import data' },
      { status: 500 }
    );
  }
}
