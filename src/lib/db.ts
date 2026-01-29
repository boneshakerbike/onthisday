/**
 * Database utilities for On This Day
 * Uses Turso (libSQL) in production, better-sqlite3 for local development
 */

import { createClient, Client } from '@libsql/client';

// Detect if we're using Turso (production) or SQLite (local)
const is_turso = !!process.env.TURSO_DATABASE_URL;

let client: Client | null = null;

function get_client(): Client {
  if (!client) {
    if (is_turso) {
      // Production: Turso
      client = createClient({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
    } else {
      // Local development: SQLite file
      const path = require('path');
      const fs = require('fs');
      const db_path = path.join(process.cwd(), 'data', 'posts.db');

      // Ensure data directory exists
      const dir = path.dirname(db_path);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      client = createClient({
        url: `file:${db_path}`,
      });
    }
  }
  return client;
}

async function init_schema(): Promise<void> {
  const db = get_client();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      post_date TEXT NOT NULL,
      local_date TEXT NOT NULL,
      audience TEXT,
      type TEXT,
      content_html TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_posts_local_date ON posts(local_date)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_posts_month_day ON posts(
      substr(local_date, 6, 2),
      substr(local_date, 9, 2)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS archive_info (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      filename TEXT,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      date_key TEXT NOT NULL,
      date_display TEXT NOT NULL,
      content TEXT NOT NULL,
      post_count INTEGER NOT NULL,
      image_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_stories_date_key ON stories(date_key)
  `);

  // Migration: add image_url column if missing
  try {
    await db.execute(`ALTER TABLE stories ADD COLUMN image_url TEXT`);
  } catch {
    // Column already exists, ignore error
  }
}

// Initialize schema on module load
let schema_initialized = false;
async function ensure_schema(): Promise<void> {
  if (!schema_initialized) {
    await init_schema();
    schema_initialized = true;
  }
}

/**
 * Convert UTC date string to Mountain Time date (YYYY-MM-DD)
 */
function utc_to_mountain(utc_date: string): string {
  const date = new Date(utc_date);
  return date.toLocaleDateString('en-CA', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

export interface Post {
  id: number;
  post_id: string;
  title: string;
  subtitle: string | null;
  post_date: string;
  local_date: string;
  audience: string | null;
  type: string | null;
  content_html: string | null;
}

export interface PostWithMeta extends Post {
  year: number;
  formatted_date: string;
  years_ago: number;
  blurb: string | null;
}

/**
 * Get posts matching a specific month and day across all years
 */
export async function get_posts_on_date(month: number, day: number): Promise<PostWithMeta[]> {
  await ensure_schema();
  const db = get_client();

  const month_str = month.toString().padStart(2, '0');
  const day_str = day.toString().padStart(2, '0');

  const result = await db.execute({
    sql: `
      SELECT * FROM posts
      WHERE substr(local_date, 6, 2) = ?
        AND substr(local_date, 9, 2) = ?
      ORDER BY local_date ASC
    `,
    args: [month_str, day_str]
  });

  const current_year = new Date().getFullYear();

  return result.rows.map(row => {
    const post = row as unknown as Post;
    const year = parseInt(post.local_date.substring(0, 4), 10);
    const date = new Date(post.local_date + 'T12:00:00');
    return {
      ...post,
      year,
      formatted_date: date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }),
      years_ago: current_year - year,
      blurb: post.subtitle || extract_blurb(post.content_html)
    };
  });
}

/**
 * Extract first paragraph from HTML content as blurb
 */
function extract_blurb(html: string | null, max_len: number = 200): string | null {
  if (!html) return null;

  const match = html.match(/<p[^>]*>(.+?)<\/p>/is);
  if (!match) return null;

  let text = match[1].replace(/<[^>]*>/g, '');
  text = text.replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'")
             .replace(/&nbsp;/g, ' ');
  text = text.trim();

  if (text.length > max_len) {
    text = text.substring(0, max_len).replace(/\s+\S*$/, '') + '...';
  }

  return text || null;
}

/**
 * Clear all posts from the database
 */
export async function clear_posts(): Promise<void> {
  await ensure_schema();
  const db = get_client();
  await db.execute('DELETE FROM posts');
}

/**
 * Clear all posts and insert new ones from CSV data
 */
export async function import_posts(posts: Array<{
  post_id: string;
  title: string;
  subtitle?: string;
  post_date: string;
  audience?: string;
  type?: string;
}>, html_files: Map<string, string>): Promise<{ processed: number; inserted: number }> {
  await clear_posts();
  return append_posts(posts, html_files);
}

/**
 * Append posts without clearing existing data
 */
export async function append_posts(posts: Array<{
  post_id: string;
  title: string;
  subtitle?: string;
  post_date: string;
  audience?: string;
  type?: string;
}>, html_files: Map<string, string>): Promise<{ processed: number; inserted: number }> {
  await ensure_schema();
  const db = get_client();

  let processed = 0;
  let inserted = 0;

  for (const post of posts) {
    if (!post.post_date || !post.title) continue;

    const local_date = utc_to_mountain(post.post_date);
    const html = html_files.get(post.post_id) || null;

    const result = await db.execute({
      sql: `
        INSERT OR IGNORE INTO posts (post_id, title, subtitle, post_date, local_date, audience, type, content_html)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        post.post_id,
        post.title,
        post.subtitle || null,
        post.post_date,
        local_date,
        post.audience || null,
        post.type || null,
        html
      ]
    });
    processed++;
    if (result.rowsAffected && result.rowsAffected > 0) {
      inserted++;
    }
  }

  return { processed, inserted };
}

/**
 * Update archive info
 */
export async function set_archive_info(filename: string): Promise<void> {
  await ensure_schema();
  const db = get_client();

  await db.execute({
    sql: `
      INSERT OR REPLACE INTO archive_info (id, filename, uploaded_at)
      VALUES (1, ?, CURRENT_TIMESTAMP)
    `,
    args: [filename]
  });
}

/**
 * Get archive info
 */
export async function get_archive_info(): Promise<{ filename: string; uploaded_at: string } | null> {
  await ensure_schema();
  const db = get_client();

  const result = await db.execute('SELECT filename, uploaded_at FROM archive_info WHERE id = 1');

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    filename: row.filename as string,
    uploaded_at: row.uploaded_at as string
  };
}

/**
 * Get total post count
 */
export async function get_post_count(): Promise<number> {
  await ensure_schema();
  const db = get_client();

  const result = await db.execute('SELECT COUNT(*) as count FROM posts');
  return Number(result.rows[0].count);
}

/**
 * Update HTML content for an existing post
 */
export async function update_post_html(post_id: string, html: string, only_if_empty: boolean = false): Promise<boolean> {
  await ensure_schema();
  const db = get_client();

  const sql = only_if_empty
    ? "UPDATE posts SET content_html = ? WHERE post_id = ? AND (content_html IS NULL OR content_html = '')"
    : 'UPDATE posts SET content_html = ? WHERE post_id = ?';

  const result = await db.execute({
    sql,
    args: [html, post_id]
  });

  return (result.rowsAffected ?? 0) > 0;
}

/**
 * Generate Substack URL from post_id
 */
export function get_post_url(post_id: string): string {
  const parts = post_id.split('.', 2);
  const slug = parts[1] || post_id;
  return `https://8i11.substack.com/p/${encodeURIComponent(slug)}`;
}

/**
 * Get all post IDs in the database
 */
export async function get_all_post_ids(): Promise<string[]> {
  await ensure_schema();
  const db = get_client();

  const result = await db.execute('SELECT post_id FROM posts');
  return result.rows.map(row => row.post_id as string);
}

/**
 * Add a single post from RSS feed data
 */
export async function add_post_from_rss(post: {
  post_id: string;
  title: string;
  url: string;
  post_date: string;
  content_html: string;
}): Promise<void> {
  await ensure_schema();
  const db = get_client();

  const local_date = utc_to_mountain(post.post_date);

  await db.execute({
    sql: `
      INSERT OR IGNORE INTO posts (post_id, title, subtitle, post_date, local_date, audience, type, content_html)
      VALUES (?, ?, NULL, ?, ?, 'everyone', 'newsletter', ?)
    `,
    args: [
      post.post_id,
      post.title,
      post.post_date,
      local_date,
      post.content_html
    ]
  });
}

// ============================================================================
// Stories
// ============================================================================

export interface Story {
  id: string;
  date_key: string;
  date_display: string;
  content: string;
  post_count: number;
  image_url: string | null;
  created_at: string;
}

/**
 * Generate a short unique ID for stories
 */
function generate_story_id(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Save a generated story (replaces any existing story for this date)
 */
export async function save_story(
  date_key: string,
  date_display: string,
  content: string,
  post_count: number,
  image_url: string | null = null
): Promise<string> {
  await ensure_schema();
  const db = get_client();

  // Check if a story already exists for this date
  const existing = await db.execute({
    sql: 'SELECT id FROM stories WHERE date_key = ?',
    args: [date_key]
  });

  if (existing.rows.length > 0) {
    // Update existing story (keep the same ID for stable URLs)
    const id = existing.rows[0].id as string;
    await db.execute({
      sql: `
        UPDATE stories
        SET date_display = ?, content = ?, post_count = ?, image_url = ?, created_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [date_display, content, post_count, image_url, id]
    });
    return id;
  } else {
    // Create new story
    const id = generate_story_id();
    await db.execute({
      sql: `
        INSERT INTO stories (id, date_key, date_display, content, post_count, image_url)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [id, date_key, date_display, content, post_count, image_url]
    });
    return id;
  }
}

/**
 * Get a story by ID
 */
export async function get_story(id: string): Promise<Story | null> {
  await ensure_schema();
  const db = get_client();

  const result = await db.execute({
    sql: 'SELECT * FROM stories WHERE id = ?',
    args: [id]
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    date_key: row.date_key as string,
    date_display: row.date_display as string,
    content: row.content as string,
    post_count: row.post_count as number,
    image_url: (row.image_url as string) || null,
    created_at: row.created_at as string
  };
}

/**
 * Clean up duplicate stories, keeping only the most recent for each date
 * Returns number of duplicates removed
 */
export async function cleanup_duplicate_stories(): Promise<number> {
  await ensure_schema();
  const db = get_client();

  // Find all date_keys with multiple stories
  const duplicates = await db.execute(`
    SELECT date_key, COUNT(*) as count
    FROM stories
    GROUP BY date_key
    HAVING count > 1
  `);

  let removed = 0;

  for (const row of duplicates.rows) {
    const date_key = row.date_key as string;

    // Get all stories for this date, ordered by created_at DESC
    const stories = await db.execute({
      sql: 'SELECT id FROM stories WHERE date_key = ? ORDER BY created_at DESC',
      args: [date_key]
    });

    // Delete all but the first (most recent) one
    for (let i = 1; i < stories.rows.length; i++) {
      await db.execute({
        sql: 'DELETE FROM stories WHERE id = ?',
        args: [stories.rows[i].id as string]
      });
      removed++;
    }
  }

  return removed;
}

/**
 * Get the most recent story for a date
 */
export async function get_story_by_date(date_key: string): Promise<Story | null> {
  await ensure_schema();
  const db = get_client();

  const result = await db.execute({
    sql: 'SELECT * FROM stories WHERE date_key = ? ORDER BY created_at DESC LIMIT 1',
    args: [date_key]
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    date_key: row.date_key as string,
    date_display: row.date_display as string,
    content: row.content as string,
    post_count: row.post_count as number,
    image_url: (row.image_url as string) || null,
    created_at: row.created_at as string
  };
}
