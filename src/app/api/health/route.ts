/**
 * API route: GET /api/health
 * Returns database health stats including duplicate check
 */

import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const is_turso = !!process.env.TURSO_DATABASE_URL;

function get_client() {
  if (is_turso) {
    return createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  } else {
    const path = require('path');
    return createClient({
      url: `file:${path.join(process.cwd(), 'data', 'posts.db')}`,
    });
  }
}

export async function GET() {
  try {
    const db = get_client();

    const total = await db.execute('SELECT COUNT(*) as count FROM posts');
    const unique = await db.execute('SELECT COUNT(DISTINCT post_id) as count FROM posts');
    const duplicates = await db.execute(
      'SELECT post_id, COUNT(*) as count FROM posts GROUP BY post_id HAVING COUNT(*) > 1'
    );

    const total_count = Number(total.rows[0].count);
    const unique_count = Number(unique.rows[0].count);

    return NextResponse.json({
      status: 'ok',
      database: is_turso ? 'turso' : 'sqlite',
      total_posts: total_count,
      unique_post_ids: unique_count,
      duplicate_count: duplicates.rows.length,
      duplicates: duplicates.rows.length > 0
        ? duplicates.rows.map(r => ({ post_id: r.post_id, count: r.count }))
        : null
    });

  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Health check failed' },
      { status: 500 }
    );
  }
}
