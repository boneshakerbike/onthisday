/**
 * API route: /api/suggestions
 * Manage feature suggestions and ideas
 *
 * GET - List suggestions (optional ?status=pending filter) - REQUIRES AUTH
 * POST - Create new suggestion - REQUIRES AUTH
 * PATCH - Update suggestion status - REQUIRES AUTH
 * DELETE - Remove suggestion - REQUIRES AUTH
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import Anthropic from '@anthropic-ai/sdk';
import {
  get_suggestions,
  get_suggestion,
  create_suggestion,
  update_suggestion,
  update_suggestion_tags,
  update_suggestion_content,
  update_suggestion_title,
  update_suggestion_title_and_content,
  delete_suggestion,
  assign_suggestion,
  set_suggestion_blocked,
  release_stale_assignments,
  Suggestion
} from '@/lib/db';

export const maxDuration = 30;

// CORS headers for cross-origin requests (production + localhost dev)
const ALLOWED_ORIGINS = ['https://8i11.vercel.app', 'http://localhost:3000'];

function cors_headers(origin?: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Guest-Pin, X-Chipboard-Key',
  };
}

async function require_auth(request: NextRequest): Promise<NextResponse | null> {
  // Check for session token first
  const token = await getToken({ req: request });
  if (token) {
    return null;
  }

  // Check for X-Guest-Pin header (for CLI access)
  const pin_header = request.headers.get('X-Guest-Pin');
  if (pin_header) {
    const valid_pins = (process.env.GUEST_PINS || process.env.GUEST_PIN || '').split(',').map(p => p.trim()).filter(Boolean);
    if (valid_pins.includes(pin_header)) {
      return null;
    }
  }

  return NextResponse.json(
    { error: 'Authentication required' },
    { status: 401, headers: cors_headers() }
  );
}

// Read-only auth: session, X-Guest-Pin (full agent access), or X-Chipboard-Key (reviewer read-only)
async function require_read_auth(request: NextRequest): Promise<NextResponse | null> {
  const token = await getToken({ req: request });
  if (token) return null;

  const pin_header = request.headers.get('X-Guest-Pin');
  if (pin_header) {
    const valid_pins = (process.env.GUEST_PINS || process.env.GUEST_PIN || '').split(',').map(p => p.trim()).filter(Boolean);
    if (valid_pins.includes(pin_header)) return null;
  }

  const chipboard_key = request.headers.get('X-Chipboard-Key');
  if (chipboard_key) {
    const valid_keys = (process.env.CHIPBOARD_READ_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
    if (valid_keys.length > 0 && valid_keys.includes(chipboard_key)) return null;
  }

  return NextResponse.json(
    { error: 'Authentication required' },
    { status: 401, headers: cors_headers() }
  );
}

async function is_bill_request(request: NextRequest): Promise<boolean> {
  const token = await getToken({ req: request });
  return !!token && token.sub !== 'guest';
}

// Run Haiku to generate a short title + cleaned content from raw text
async function ai_cleanup(raw: string): Promise<{ title: string; content: string } | null> {
  const api_key = process.env.ANTHROPIC_API_KEY;
  if (!api_key) return null;
  try {
    const client = new Anthropic({ apiKey: api_key });
    const result = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are a task board editor. Given a task entry (often voice-to-text), return ONLY valid JSON with two fields:
- "title": 5-8 word title, imperative or noun phrase, no period at end
- "content": full entry cleaned up — fix grammar/punctuation, remove filler words, preserve ALL details and intent

Respond with raw JSON only, no markdown, no code fences.

ENTRY:
${raw.trim()}`
      }]
    });
    if (result.content[0].type === 'text') {
      // Strip markdown code fences if Haiku wraps the JSON anyway
      const raw_text = result.content[0].text.trim()
        .replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(raw_text);
      if (parsed.title && parsed.content) return parsed;
    }
  } catch { /* fall through */ }
  return null;
}

// When running locally, proxy mutations to production
const is_local = !process.env.TURSO_DATABASE_URL;
const PROD_API = 'https://8i11.vercel.app/api/suggestions';

async function proxy_to_prod(method: string, body?: string, query?: string) {
  const pin = process.env.GUEST_PINS?.split(',')[0] || process.env.GUEST_PIN || '';
  const url = query ? `${PROD_API}?${query}` : PROD_API;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Guest-Pin': pin,
    },
    ...(body ? { body } : {}),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: cors_headers(request.headers.get('origin')) });
}

export async function GET(request: NextRequest) {
  const auth_error = await require_read_auth(request);
  if (auth_error) return auth_error;

  try {
    // Release stale claims on every GET (lightweight, no-op if none expired)
    await release_stale_assignments();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const tag = searchParams.get('tag') || undefined;

    const suggestions = await get_suggestions(status, tag);

    return NextResponse.json({
      success: true,
      suggestions,
      count: suggestions.length
    }, { headers: cors_headers(request.headers.get('origin')) });
  } catch (error) {
    console.error('GET suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500, headers: cors_headers(request.headers.get('origin')) }
    );
  }
}

export async function POST(request: NextRequest) {
  if (is_local) {
    const body = await request.text();
    return proxy_to_prod('POST', body);
  }

  const auth_error = await require_auth(request);
  if (auth_error) return auth_error;

  try {
    const { content, tags } = await request.json();

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: 'Content must be under 5000 characters' },
        { status: 413 }
      );
    }

    // Save immediately so the item always lands even if Haiku is slow
    const id = await create_suggestion(content.trim(), null, tags || undefined);

    // AI cleanup: best-effort, 8s timeout — updates title + content if it succeeds
    const cleanup = await Promise.race([
      ai_cleanup(content),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 8000))
    ]);
    if (cleanup) {
      await update_suggestion_title_and_content(id, cleanup.title, cleanup.content);
    }

    return NextResponse.json({
      success: true,
      id,
      message: 'Suggestion created'
    }, { headers: cors_headers(request.headers.get('origin')) });
  } catch (error) {
    console.error('POST suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to create suggestion' },
      { status: 500, headers: cors_headers() }
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (is_local) {
    const body = await request.text();
    return proxy_to_prod('PATCH', body);
  }

  const auth_error = await require_auth(request);
  if (auth_error) return auth_error;

  try {
    const { id, status, outcome, title, content, tags, assigned_to, blocked_reason, cleanup } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Suggestion ID is required' },
        { status: 400 }
      );
    }

    // AI cleanup: regenerate title + clean content for an existing item
    if (cleanup === true) {
      const existing = await get_suggestion(id);
      if (!existing) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
      const result = await ai_cleanup(existing.content);
      if (!result) return NextResponse.json({ error: 'AI cleanup unavailable' }, { status: 503 });
      await update_suggestion_title_and_content(id, result.title, result.content);
      return NextResponse.json({ success: true, message: 'Cleaned up' }, { headers: cors_headers(request.headers.get('origin')) });
    }

    // assigned_to update
    if (assigned_to !== undefined && !status && content === undefined && tags === undefined) {
      const updated = await assign_suggestion(id, assigned_to || null);
      if (!updated) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
      return NextResponse.json({ success: true, message: 'Assignment updated' }, { headers: cors_headers() });
    }

    // blocked_reason update
    if (blocked_reason !== undefined && !status && content === undefined && tags === undefined) {
      const updated = await set_suggestion_blocked(id, blocked_reason || null);
      if (!updated) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
      return NextResponse.json({ success: true, message: 'Blocked reason updated' }, { headers: cors_headers() });
    }

    // Tags-only update
    if (tags !== undefined && !status && content === undefined) {
      const updated = await update_suggestion_tags(id, tags || null);
      if (!updated) {
        return NextResponse.json(
          { error: 'Suggestion not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        message: 'Suggestion tags updated'
      }, { headers: cors_headers() });
    }

    // Title/content edit (no status change) — handles title-only, content-only, or both
    if ((content !== undefined || title !== undefined) && !status) {
      if (content !== undefined && (typeof content !== 'string' || content.trim().length === 0)) {
        return NextResponse.json(
          { error: 'Content cannot be empty' },
          { status: 400 }
        );
      }
      let updated: boolean;
      if (title !== undefined && content !== undefined) {
        updated = await update_suggestion_title_and_content(id, title.trim(), content.trim());
      } else if (title !== undefined) {
        updated = await update_suggestion_title(id, title.trim());
      } else {
        updated = await update_suggestion_content(id, content!.trim());
      }
      if (!updated) {
        return NextResponse.json(
          { error: 'Suggestion not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        message: 'Suggestion updated'
      }, { headers: cors_headers() });
    }

    const valid_statuses: Suggestion['status'][] = ['inbox', 'todo', 'inwork', 'testing', 'done', 'rejected'];
    if (!status || !valid_statuses.includes(status)) {
      return NextResponse.json(
        { error: 'Valid status is required: inbox, todo, inwork, testing, done, rejected' },
        { status: 400 }
      );
    }

    const updated = await update_suggestion(id, status, outcome);

    if (!updated) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Suggestion updated'
    }, { headers: cors_headers() });
  } catch (error) {
    console.error('PATCH suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to update suggestion' },
      { status: 500, headers: cors_headers() }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (is_local) {
    const { searchParams } = new URL(request.url);
    return proxy_to_prod('DELETE', undefined, `id=${searchParams.get('id')}`);
  }

  const auth_error = await require_auth(request);
  if (auth_error) return auth_error;

  if (!(await is_bill_request(request))) {
    return NextResponse.json(
      { error: 'Only Bill can delete items' },
      { status: 403, headers: cors_headers() }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Suggestion ID is required' },
        { status: 400 }
      );
    }

    const deleted = await delete_suggestion(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Suggestion deleted'
    }, { headers: cors_headers() });
  } catch (error) {
    console.error('DELETE suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to delete suggestion' },
      { status: 500, headers: cors_headers() }
    );
  }
}
