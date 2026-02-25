/**
 * API route: /api/suggestions/plan
 * Set or update the plan field on a Chipboard item
 * Plan is a dedicated field — never compacted, replace-not-append
 *
 * POST - Set/update plan (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { set_suggestion_plan, get_suggestion } from '@/lib/db';

const ALLOWED_ORIGINS = ['https://8i11.vercel.app', 'http://localhost:3000'];

function cors_headers(origin?: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Guest-Pin',
  };
}

async function require_bill(request: NextRequest): Promise<NextResponse | null> {
  const token = await getToken({ req: request });
  if (token && token.sub !== 'guest') return null;

  return NextResponse.json({ error: 'Admin access required' }, { status: 403, headers: cors_headers() });
}

const is_local = !process.env.TURSO_DATABASE_URL;
const PROD_API = 'https://8i11.vercel.app/api/suggestions/plan';

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

  const auth_error = await require_bill(request);
  if (auth_error) return auth_error;

  try {
    const { id, plan } = await request.json();

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: cors_headers() });
    }
    if (plan !== null && typeof plan !== 'string') {
      return NextResponse.json({ error: 'plan must be a string or null' }, { status: 400, headers: cors_headers() });
    }
    if (typeof plan === 'string' && plan.length > 100000) {
      return NextResponse.json({ error: 'plan must be under 100,000 characters' }, { status: 413, headers: cors_headers() });
    }

    const item = await get_suggestion(id);
    if (!item) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404, headers: cors_headers() });
    }

    await set_suggestion_plan(id, plan);
    return NextResponse.json({ success: true, plan }, { headers: cors_headers() });
  } catch (error) {
    console.error('POST plan error:', error);
    return NextResponse.json({ error: 'Failed to set plan' }, { status: 500, headers: cors_headers() });
  }
}
