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
 * Clean up duplicate posts where slug matches but post_id format differs
 * Keeps posts with numeric prefix (from CSV), removes slug-only (from RSS)
 * Returns number of duplicates removed
 */
export async function cleanup_duplicate_posts(): Promise<number> {
  await ensure_schema();
  const db = get_client();

  // Get all post_ids
  const all_posts = await db.execute('SELECT id, post_id FROM posts');

  // Group by slug (part after dot, or whole id if no dot)
  const by_slug: Map<string, Array<{ id: number; post_id: string; has_prefix: boolean }>> = new Map();

  for (const row of all_posts.rows) {
    const post_id = row.post_id as string;
    const parts = post_id.split('.', 2);
    const slug = parts.length > 1 ? parts[1] : parts[0];
    const has_prefix = parts.length > 1 && /^\d+$/.test(parts[0]);

    if (!by_slug.has(slug)) {
      by_slug.set(slug, []);
    }
    by_slug.get(slug)!.push({
      id: row.id as number,
      post_id,
      has_prefix
    });
  }

  // Find duplicates and delete the ones without prefix
  let removed = 0;
  for (const [, posts] of by_slug) {
    if (posts.length > 1) {
      // Keep the one with prefix, delete others
      const to_delete = posts.filter(p => !p.has_prefix);
      for (const post of to_delete) {
        await db.execute({
          sql: 'DELETE FROM posts WHERE id = ?',
          args: [post.id]
        });
        removed++;
      }
    }
  }

  return removed;
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

/**
 * Get all stories, ordered by date_key
 */
export async function get_all_stories(): Promise<Story[]> {
  await ensure_schema();
  const db = get_client();

  const result = await db.execute(
    'SELECT * FROM stories ORDER BY date_key ASC'
  );

  return result.rows.map(row => ({
    id: row.id as string,
    date_key: row.date_key as string,
    date_display: row.date_display as string,
    content: row.content as string,
    post_count: row.post_count as number,
    image_url: (row.image_url as string) || null,
    created_at: row.created_at as string
  }));
}

/**
 * Delete a story by ID
 */
export async function delete_story(id: string): Promise<boolean> {
  await ensure_schema();
  const db = get_client();

  const result = await db.execute({
    sql: 'DELETE FROM stories WHERE id = ?',
    args: [id]
  });

  return result.rowsAffected > 0;
}

/**
 * Get adjacent stories for navigation (prev/next by date_key)
 */
export async function get_adjacent_stories(date_key: string): Promise<{
  prev: { id: string; date_display: string } | null;
  next: { id: string; date_display: string } | null;
}> {
  await ensure_schema();
  const db = get_client();

  // Get previous story (smaller date_key)
  const prev_result = await db.execute({
    sql: 'SELECT id, date_display FROM stories WHERE date_key < ? ORDER BY date_key DESC LIMIT 1',
    args: [date_key]
  });

  // Get next story (larger date_key)
  const next_result = await db.execute({
    sql: 'SELECT id, date_display FROM stories WHERE date_key > ? ORDER BY date_key ASC LIMIT 1',
    args: [date_key]
  });

  return {
    prev: prev_result.rows.length > 0
      ? { id: prev_result.rows[0].id as string, date_display: prev_result.rows[0].date_display as string }
      : null,
    next: next_result.rows.length > 0
      ? { id: next_result.rows[0].id as string, date_display: next_result.rows[0].date_display as string }
      : null
  };
}

// ============================================================================
// Suggestions
// ============================================================================

export interface Suggestion {
  id: string;
  content: string;
  status: 'pending' | 'considering' | 'done' | 'rejected';
  created_at: string;
  resolved_at: string | null;
  outcome: string | null;
}

/**
 * Initialize suggestions table
 */
async function init_suggestions_schema(): Promise<void> {
  const db = get_client();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT,
      outcome TEXT
    )
  `);
}

// Track if suggestions schema is initialized
let suggestions_schema_initialized = false;
async function ensure_suggestions_schema(): Promise<void> {
  if (!suggestions_schema_initialized) {
    await init_suggestions_schema();
    suggestions_schema_initialized = true;
  }
}

/**
 * Generate a short unique ID for suggestions
 */
function generate_suggestion_id(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Create a new suggestion
 */
export async function create_suggestion(content: string): Promise<string> {
  await ensure_suggestions_schema();
  const db = get_client();

  const id = generate_suggestion_id();
  await db.execute({
    sql: `INSERT INTO suggestions (id, content) VALUES (?, ?)`,
    args: [id, content]
  });

  return id;
}

/**
 * Get all suggestions, optionally filtered by status
 */
export async function get_suggestions(status?: string): Promise<Suggestion[]> {
  await ensure_suggestions_schema();
  const db = get_client();

  let result;
  if (status) {
    result = await db.execute({
      sql: 'SELECT * FROM suggestions WHERE status = ? ORDER BY created_at DESC',
      args: [status]
    });
  } else {
    result = await db.execute(
      'SELECT * FROM suggestions ORDER BY created_at DESC'
    );
  }

  return result.rows.map(row => ({
    id: row.id as string,
    content: row.content as string,
    status: row.status as Suggestion['status'],
    created_at: row.created_at as string,
    resolved_at: (row.resolved_at as string) || null,
    outcome: (row.outcome as string) || null
  }));
}

/**
 * Get a single suggestion by ID
 */
export async function get_suggestion(id: string): Promise<Suggestion | null> {
  await ensure_suggestions_schema();
  const db = get_client();

  const result = await db.execute({
    sql: 'SELECT * FROM suggestions WHERE id = ?',
    args: [id]
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    content: row.content as string,
    status: row.status as Suggestion['status'],
    created_at: row.created_at as string,
    resolved_at: (row.resolved_at as string) || null,
    outcome: (row.outcome as string) || null
  };
}

/**
 * Update a suggestion's status and outcome
 */
export async function update_suggestion(
  id: string,
  status: Suggestion['status'],
  outcome?: string
): Promise<boolean> {
  await ensure_suggestions_schema();
  const db = get_client();

  const resolved_at = (status === 'done' || status === 'rejected')
    ? new Date().toISOString()
    : null;

  const result = await db.execute({
    sql: `
      UPDATE suggestions
      SET status = ?, outcome = ?, resolved_at = ?
      WHERE id = ?
    `,
    args: [status, outcome || null, resolved_at, id]
  });

  return result.rowsAffected > 0;
}

/**
 * Delete a suggestion
 */
export async function delete_suggestion(id: string): Promise<boolean> {
  await ensure_suggestions_schema();
  const db = get_client();

  const result = await db.execute({
    sql: 'DELETE FROM suggestions WHERE id = ?',
    args: [id]
  });

  return result.rowsAffected > 0;
}

// ============================================================================
// Prompts (Prompt Library)
// ============================================================================

export interface Prompt {
  id: string;
  name: string;
  current_content: string;
  notes: string;
  tags: string[];
  version_count: number;
  created_at: string;
  updated_at: string;
}

export interface PromptVersion {
  id: string;
  prompt_id: string;
  version_number: number;
  content: string;
  note: string | null;
  created_at: string;
}

/**
 * Initialize prompts tables
 */
async function init_prompts_schema(): Promise<void> {
  const db = get_client();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      current_content TEXT NOT NULL,
      version_count INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS prompt_versions (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      content TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id
    ON prompt_versions(prompt_id, version_number DESC)
  `);

  // Migration: add notes column to prompts
  try {
    await db.execute(`ALTER TABLE prompts ADD COLUMN notes TEXT NOT NULL DEFAULT ''`);
  } catch {
    // Column already exists
  }

  // Migration: add tags column to prompts
  try {
    await db.execute(`ALTER TABLE prompts ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`);
  } catch {
    // Column already exists
  }
}

let prompts_schema_initialized = false;
async function ensure_prompts_schema(): Promise<void> {
  if (!prompts_schema_initialized) {
    await init_prompts_schema();
    prompts_schema_initialized = true;
  }
}

/**
 * Generate a short unique ID
 */
function generate_id(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Create a new prompt (no version until first save)
 */
export async function create_prompt(name: string, content: string): Promise<string> {
  await ensure_prompts_schema();
  const db = get_client();

  const prompt_id = generate_id();

  await db.execute({
    sql: `INSERT INTO prompts (id, name, current_content, version_count) VALUES (?, ?, ?, 0)`,
    args: [prompt_id, name, content]
  });

  return prompt_id;
}

/**
 * Get all prompts (metadata only, no version history)
 */
export async function get_all_prompts(): Promise<Prompt[]> {
  await ensure_prompts_schema();
  const db = get_client();

  const result = await db.execute('SELECT * FROM prompts ORDER BY updated_at DESC');

  return result.rows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    current_content: row.current_content as string,
    notes: (row.notes as string) || '',
    tags: JSON.parse((row.tags as string) || '[]') as string[],
    version_count: row.version_count as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  }));
}

/**
 * Get a single prompt by ID
 */
export async function get_prompt(id: string): Promise<Prompt | null> {
  await ensure_prompts_schema();
  const db = get_client();

  const result = await db.execute({
    sql: 'SELECT * FROM prompts WHERE id = ?',
    args: [id]
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    name: row.name as string,
    current_content: row.current_content as string,
    notes: (row.notes as string) || '',
    tags: JSON.parse((row.tags as string) || '[]') as string[],
    version_count: row.version_count as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  };
}

/**
 * Update prompt notes
 */
export async function update_prompt_notes(id: string, notes: string): Promise<boolean> {
  await ensure_prompts_schema();
  const db = get_client();

  const result = await db.execute({
    sql: 'UPDATE prompts SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    args: [notes, id]
  });
  return result.rowsAffected > 0;
}

/**
 * Update prompt tags
 */
export async function update_prompt_tags(id: string, tags: string[]): Promise<boolean> {
  await ensure_prompts_schema();
  const db = get_client();

  const result = await db.execute({
    sql: 'UPDATE prompts SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    args: [JSON.stringify(tags), id]
  });
  return result.rowsAffected > 0;
}

/**
 * Get all unique tags across all prompts (for autocomplete)
 */
export async function get_all_prompt_tags(): Promise<string[]> {
  await ensure_prompts_schema();
  const db = get_client();

  const result = await db.execute('SELECT tags FROM prompts');
  const tag_set = new Set<string>();

  for (const row of result.rows) {
    const tags: string[] = JSON.parse((row.tags as string) || '[]');
    for (const tag of tags) {
      tag_set.add(tag);
    }
  }

  return Array.from(tag_set).sort();
}

/**
 * Save a new version of a prompt
 */
export async function save_prompt_version(
  prompt_id: string,
  content: string,
  note?: string
): Promise<number> {
  await ensure_prompts_schema();
  const db = get_client();

  // Get current version count
  const prompt = await db.execute({
    sql: 'SELECT version_count FROM prompts WHERE id = ?',
    args: [prompt_id]
  });

  if (prompt.rows.length === 0) {
    throw new Error('Prompt not found');
  }

  const new_version = (prompt.rows[0].version_count as number) + 1;
  const version_id = generate_id();

  // Insert new version
  await db.execute({
    sql: `INSERT INTO prompt_versions (id, prompt_id, version_number, content, note) VALUES (?, ?, ?, ?, ?)`,
    args: [version_id, prompt_id, new_version, content, note || null]
  });

  // Update prompt
  await db.execute({
    sql: `UPDATE prompts SET current_content = ?, version_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    args: [content, new_version, prompt_id]
  });

  return new_version;
}

/**
 * Get all versions of a prompt
 */
export async function get_prompt_versions(prompt_id: string): Promise<PromptVersion[]> {
  await ensure_prompts_schema();
  const db = get_client();

  const result = await db.execute({
    sql: 'SELECT * FROM prompt_versions WHERE prompt_id = ? ORDER BY version_number DESC',
    args: [prompt_id]
  });

  return result.rows.map(row => ({
    id: row.id as string,
    prompt_id: row.prompt_id as string,
    version_number: row.version_number as number,
    content: row.content as string,
    note: (row.note as string) || null,
    created_at: row.created_at as string
  }));
}

/**
 * Rename a prompt
 */
export async function rename_prompt(id: string, name: string): Promise<boolean> {
  await ensure_prompts_schema();
  const db = get_client();

  const result = await db.execute({
    sql: 'UPDATE prompts SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    args: [name, id]
  });

  return result.rowsAffected > 0;
}

/**
 * Delete a prompt and all its versions
 */
export async function delete_prompt(id: string): Promise<boolean> {
  await ensure_prompts_schema();
  const db = get_client();

  await db.execute({
    sql: 'DELETE FROM prompt_versions WHERE prompt_id = ?',
    args: [id]
  });

  const result = await db.execute({
    sql: 'DELETE FROM prompts WHERE id = ?',
    args: [id]
  });

  return result.rowsAffected > 0;
}

/**
 * Trim old versions, keeping only the most recent N
 * Returns number of versions deleted
 */
export async function trim_prompt_versions(prompt_id: string, keep_count: number): Promise<number> {
  await ensure_prompts_schema();
  const db = get_client();

  // Get versions to delete (all except the latest keep_count)
  const to_delete = await db.execute({
    sql: `SELECT id FROM prompt_versions WHERE prompt_id = ? ORDER BY version_number DESC LIMIT -1 OFFSET ?`,
    args: [prompt_id, keep_count]
  });

  if (to_delete.rows.length === 0) return 0;

  for (const row of to_delete.rows) {
    await db.execute({
      sql: 'DELETE FROM prompt_versions WHERE id = ?',
      args: [row.id as string]
    });
  }

  // Update version_count on the prompt
  const remaining = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM prompt_versions WHERE prompt_id = ?',
    args: [prompt_id]
  });

  await db.execute({
    sql: 'UPDATE prompts SET version_count = ? WHERE id = ?',
    args: [remaining.rows[0].count as number, prompt_id]
  });

  return to_delete.rows.length;
}
