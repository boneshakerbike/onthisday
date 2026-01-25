/**
 * Database utilities for On This Day
 * Uses better-sqlite3 for local development
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'posts.db');

let db: Database.Database | null = null;

export function get_db(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    init_schema(db);
  }
  return db;
}

function init_schema(db: Database.Database): void {
  db.exec(`
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
    );

    CREATE INDEX IF NOT EXISTS idx_posts_local_date ON posts(local_date);
    CREATE INDEX IF NOT EXISTS idx_posts_month_day ON posts(
      substr(local_date, 6, 2),
      substr(local_date, 9, 2)
    );

    CREATE TABLE IF NOT EXISTS archive_info (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      filename TEXT,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

/**
 * Convert UTC date string to Mountain Time date (YYYY-MM-DD)
 */
function utc_to_mountain(utc_date: string): string {
  const date = new Date(utc_date);
  // Format in Mountain Time
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
export function get_posts_on_date(month: number, day: number): PostWithMeta[] {
  const db = get_db();
  const month_str = month.toString().padStart(2, '0');
  const day_str = day.toString().padStart(2, '0');

  const rows = db.prepare(`
    SELECT * FROM posts
    WHERE substr(local_date, 6, 2) = ?
      AND substr(local_date, 9, 2) = ?
    ORDER BY local_date ASC
  `).all(month_str, day_str) as Post[];

  const current_year = new Date().getFullYear();

  return rows.map(row => {
    // Parse year from local_date (YYYY-MM-DD format)
    const year = parseInt(row.local_date.substring(0, 4), 10);
    const date = new Date(row.local_date + 'T12:00:00');
    return {
      ...row,
      year,
      formatted_date: date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }),
      years_ago: current_year - year,
      blurb: row.subtitle || extract_blurb(row.content_html)
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

  // Strip HTML tags
  let text = match[1].replace(/<[^>]*>/g, '');
  // Decode HTML entities (basic)
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
 * Clear all posts and insert new ones from CSV data
 */
export function import_posts(posts: Array<{
  post_id: string;
  title: string;
  subtitle?: string;
  post_date: string;
  audience?: string;
  type?: string;
}>, html_files: Map<string, string>): number {
  const db = get_db();

  // Drop and recreate table to handle schema changes
  db.exec('DROP TABLE IF EXISTS posts');
  init_schema(db);

  const insert = db.prepare(`
    INSERT INTO posts (post_id, title, subtitle, post_date, local_date, audience, type, content_html)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insert_many = db.transaction((posts_data: typeof posts) => {
    let count = 0;
    for (const post of posts_data) {
      if (!post.post_date || !post.title) continue;

      // Convert UTC to Mountain Time
      const local_date = utc_to_mountain(post.post_date);

      // Find matching HTML content
      const html = html_files.get(post.post_id) || null;

      insert.run(
        post.post_id,
        post.title,
        post.subtitle || null,
        post.post_date,
        local_date,
        post.audience || null,
        post.type || null,
        html
      );
      count++;
    }
    return count;
  });

  return insert_many(posts);
}

/**
 * Update archive info
 */
export function set_archive_info(filename: string): void {
  const db = get_db();
  db.prepare(`
    INSERT OR REPLACE INTO archive_info (id, filename, uploaded_at)
    VALUES (1, ?, CURRENT_TIMESTAMP)
  `).run(filename);
}

/**
 * Get archive info
 */
export function get_archive_info(): { filename: string; uploaded_at: string } | null {
  const db = get_db();
  const row = db.prepare('SELECT filename, uploaded_at FROM archive_info WHERE id = 1').get() as
    { filename: string; uploaded_at: string } | undefined;
  return row || null;
}

/**
 * Get total post count
 */
export function get_post_count(): number {
  const db = get_db();
  const row = db.prepare('SELECT COUNT(*) as count FROM posts').get() as { count: number };
  return row.count;
}

/**
 * Generate Substack URL from post_id
 */
export function get_post_url(post_id: string): string {
  const parts = post_id.split('.', 2);
  const slug = parts[1] || post_id;
  return `https://8i11.substack.com/p/${encodeURIComponent(slug)}`;
}
