/**
 * API route: /api/suggestions/todos
 * CRUD for todo checklist items on Chipboard suggestions
 *
 * POST - Add a todo (agents + guests + admin)
 * PATCH - Check off or edit a todo (admin only)
 * DELETE - Remove a todo (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  add_suggestion_todo,
  update_suggestion_todo,
  delete_suggestion_todo,
  TodoItem,
} from '@/lib/db';

const ALLOWED_ORIGINS = ['https://8i11.vercel.app', 'http://localhost:3000'];

function cors_headers(origin?: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Guest-Pin',
  };
}

async function require_auth(request: NextRequest): Promise<NextResponse | null> {
  const token = await getToken({ req: request });
  if (token) return null;

  const pin_header = request.headers.get('X-Guest-Pin');
  if (pin_header) {
    const valid_pins = (process.env.GUEST_PINS || process.env.GUEST_PIN || '').split(',').map(p => p.trim()).filter(Boolean);
    if (valid_pins.includes(pin_header)) return null;
  }

  return NextResponse.json({ error: 'Authentication required' }, { status: 401, headers: cors_headers() });
}

async function require_bill(request: NextRequest): Promise<NextResponse | null> {
  const token = await getToken({ req: request });
  if (token && token.sub !== 'guest') return null;

  return NextResponse.json({ error: 'Admin access required' }, { status: 403, headers: cors_headers() });
}

function generate_todo_id(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Determine added_by from auth context
async function get_caller(request: NextRequest): Promise<string> {
  const token = await getToken({ req: request });
  if (token && token.sub !== 'guest') return 'bill';
  // Guest PIN — check if agent name provided in body (handled by caller)
  return 'guest';
}

// Proxy mutations to production when running locally
const is_local = !process.env.TURSO_DATABASE_URL;
const PROD_API = 'https://8i11.vercel.app/api/suggestions/todos';

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: cors_headers(request.headers.get('origin')) });
}

export async function POST(request: NextRequest) {
  if (is_local) {
    const body = await request.text();
    const pin = process.env.GUEST_PINS?.split(',')[0] || process.env.GUEST_PIN || '';
    const res = await fetch(PROD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Guest-Pin': pin },
      body,
    });
    return NextResponse.json(await res.json(), { status: res.status });
  }

  const auth_error = await require_auth(request);
  if (auth_error) return auth_error;

  try {
    const { id, text, type, added_by } = await request.json();

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: cors_headers() });
    }
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'text is required' }, { status: 400, headers: cors_headers() });
    }
    if (text.length > 100) {
      return NextResponse.json({ error: 'text must be 100 characters or fewer' }, { status: 400, headers: cors_headers() });
    }
    const valid_types = ['bug', 'feature', 'task'];
    if (!type || !valid_types.includes(type)) {
      return NextResponse.json({ error: 'type must be bug, feature, or task' }, { status: 400, headers: cors_headers() });
    }

    const caller = added_by || await get_caller(request);

    const todo: TodoItem = {
      id: generate_todo_id(),
      text: text.trim(),
      type,
      done: false,
      added_by: caller,
      created_at: new Date().toISOString(),
    };

    const todos = await add_suggestion_todo(id, todo);
    return NextResponse.json({ success: true, todos }, { headers: cors_headers() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to add todo';
    const status = msg === 'Suggestion not found' ? 404 : 500;
    console.error('POST todos error:', error);
    return NextResponse.json({ error: msg }, { status, headers: cors_headers() });
  }
}

export async function PATCH(request: NextRequest) {
  if (is_local) {
    const body = await request.text();
    const pin = process.env.GUEST_PINS?.split(',')[0] || process.env.GUEST_PIN || '';
    const res = await fetch(PROD_API, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Guest-Pin': pin },
      body,
    });
    return NextResponse.json(await res.json(), { status: res.status });
  }

  const auth_error = await require_bill(request);
  if (auth_error) return auth_error;

  try {
    const { id, todo_id, done, text } = await request.json();

    if (!id || !todo_id) {
      return NextResponse.json({ error: 'id and todo_id are required' }, { status: 400, headers: cors_headers() });
    }
    if (text !== undefined && text.length > 100) {
      return NextResponse.json({ error: 'text must be 100 characters or fewer' }, { status: 400, headers: cors_headers() });
    }

    const updates: { done?: boolean; text?: string } = {};
    if (done !== undefined) updates.done = !!done;
    if (text !== undefined) updates.text = text.trim();

    const todos = await update_suggestion_todo(id, todo_id, updates);
    return NextResponse.json({ success: true, todos }, { headers: cors_headers() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to update todo';
    const status = msg.includes('not found') ? 404 : 500;
    console.error('PATCH todos error:', error);
    return NextResponse.json({ error: msg }, { status, headers: cors_headers() });
  }
}

export async function DELETE(request: NextRequest) {
  if (is_local) {
    const body = await request.text();
    const pin = process.env.GUEST_PINS?.split(',')[0] || process.env.GUEST_PIN || '';
    const res = await fetch(PROD_API, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'X-Guest-Pin': pin },
      body,
    });
    return NextResponse.json(await res.json(), { status: res.status });
  }

  const auth_error = await require_bill(request);
  if (auth_error) return auth_error;

  try {
    const { id, todo_id } = await request.json();

    if (!id || !todo_id) {
      return NextResponse.json({ error: 'id and todo_id are required' }, { status: 400, headers: cors_headers() });
    }

    const todos = await delete_suggestion_todo(id, todo_id);
    return NextResponse.json({ success: true, todos }, { headers: cors_headers() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to delete todo';
    const status = msg.includes('not found') ? 404 : 500;
    console.error('DELETE todos error:', error);
    return NextResponse.json({ error: msg }, { status, headers: cors_headers() });
  }
}
