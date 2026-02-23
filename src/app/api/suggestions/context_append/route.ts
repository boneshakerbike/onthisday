/**
 * API route: /api/suggestions/context_append
 * Append-only context writes for Chipboard items
 * Server-side append prevents last-write-wins overwrites
 *
 * POST - Append context entry - REQUIRES AUTH
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { append_suggestion_context } from '@/lib/db';

const ALLOWED_ORIGINS = ['https://8i11.vercel.app', 'http://localhost:3000'];

function cors_headers(origin?: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

// Proxy mutations to production when running locally
const is_local = !process.env.TURSO_DATABASE_URL;
const PROD_API = 'https://8i11.vercel.app/api/suggestions/context_append';

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
    const { id, agent, entry } = await request.json();

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (!agent || typeof agent !== 'string') {
      return NextResponse.json({ error: 'agent is required' }, { status: 400 });
    }
    if (!entry || typeof entry !== 'string' || entry.trim().length === 0) {
      return NextResponse.json({ error: 'entry is required' }, { status: 400 });
    }
    if (entry.length > 100000) {
      return NextResponse.json({ error: 'entry must be under 100,000 characters' }, { status: 413 });
    }

    const updated = await append_suggestion_context(id, agent.trim(), entry.trim());

    if (!updated) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Context appended' }, { headers: cors_headers() });
  } catch (error) {
    console.error('POST context_append error:', error);
    return NextResponse.json({ error: 'Failed to append context' }, { status: 500, headers: cors_headers() });
  }
}
