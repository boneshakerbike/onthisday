/**
 * API route: /api/suggestions
 * Manage feature suggestions and ideas
 *
 * GET - List suggestions (optional ?status=pending filter) - PUBLIC
 * POST - Create new suggestion - REQUIRES AUTH
 * PATCH - Update suggestion status - REQUIRES AUTH
 * DELETE - Remove suggestion - REQUIRES AUTH
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  get_suggestions,
  create_suggestion,
  update_suggestion,
  update_suggestion_tags,
  update_suggestion_content,
  delete_suggestion,
  assign_suggestion,
  set_suggestion_blocked,
  release_stale_assignments,
  Suggestion
} from '@/lib/db';

// CORS headers for cross-origin requests (production + localhost dev)
const ALLOWED_ORIGINS = ['https://8i11.vercel.app', 'http://localhost:3000'];

function cors_headers(origin?: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Guest-Pin',
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
  try {
    // Release stale claims on every GET (lightweight, no-op if none expired)
    await release_stale_assignments();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const tag = searchParams.get('tag') || undefined;
    const is_public = searchParams.get('public') === 'true';

    const suggestions = await get_suggestions(status, tag);

    // Public mode: filtered fields only (safe for unauthenticated agent boot)
    if (is_public) {
      const filtered = suggestions.map(s => ({
        id: s.id,
        slug: s.slug,
        status: s.status,
        assigned_to: s.assigned_to,
        blocked_reason: s.blocked_reason,
        tags: s.tags,
        context_preview: s.context ? s.context.split('\n')[0] : null,
        last_context_at: s.last_context_at,
      }));
      return NextResponse.json({ success: true, suggestions: filtered, count: filtered.length }, { headers: cors_headers() });
    }

    return NextResponse.json({
      success: true,
      suggestions,
      count: suggestions.length
    }, { headers: cors_headers() });
  } catch (error) {
    console.error('GET suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500, headers: cors_headers() }
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

    const id = await create_suggestion(content.trim(), tags || undefined);

    return NextResponse.json({
      success: true,
      id,
      message: 'Suggestion created'
    }, { headers: cors_headers() });
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
    const { id, status, outcome, content, tags, assigned_to, blocked_reason } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Suggestion ID is required' },
        { status: 400 }
      );
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

    // Content-only edit (no status change)
    if (content !== undefined && !status) {
      if (typeof content !== 'string' || content.trim().length === 0) {
        return NextResponse.json(
          { error: 'Content cannot be empty' },
          { status: 400 }
        );
      }
      const updated = await update_suggestion_content(id, content.trim());
      if (!updated) {
        return NextResponse.json(
          { error: 'Suggestion not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        message: 'Suggestion content updated'
      }, { headers: cors_headers() });
    }

    const valid_statuses: Suggestion['status'][] = ['pending', 'considering', 'done', 'rejected'];
    if (!status || !valid_statuses.includes(status)) {
      return NextResponse.json(
        { error: 'Valid status is required: pending, considering, done, rejected' },
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
