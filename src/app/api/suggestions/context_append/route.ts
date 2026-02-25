/**
 * API route: /api/suggestions/context_append
 * Append-only context writes for Chipboard items
 * Server-side append prevents last-write-wins overwrites
 *
 * POST - Append context entry - REQUIRES AUTH
 *
 * Auto-compaction: if context exceeds 30KB, compacts all but the last 3 entries
 * using Haiku before appending. Transparent to callers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import Anthropic from '@anthropic-ai/sdk';
import { append_suggestion_context, get_suggestion, compact_suggestion_context } from '@/lib/db';

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

// Split context string into individual entries (each starts with [agent | timestamp])
function split_context_entries(context: string): string[] {
  return context.split(/\n\n(?=\[)/).filter(p => p.trim().length > 0);
}

const COMPACT_PROMPT = `You are compacting a project's context history into a concise current-state summary.

Write a summary covering only what's CURRENT: what's built, what works, what's broken, key decisions still relevant. Discard completed or outdated information. Do NOT summarize any content from the plan field — that is managed separately. Max 500 words.

Return valid JSON only: {"summary": "..."}`;

async function maybe_auto_compact(id: string): Promise<{ compacted: boolean; error?: string }> {
  const item = await get_suggestion(id);
  if (!item || !item.context || item.context.length <= 30000) {
    return { compacted: false };
  }

  const entries = split_context_entries(item.context);
  if (entries.length <= 3) {
    // Nothing old enough to compact
    return { compacted: false };
  }

  const api_key = process.env.ANTHROPIC_API_KEY;
  if (!api_key) return { compacted: false, error: 'no api key' };

  try {
    const client = new Anthropic({ apiKey: api_key });
    const result = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: `${COMPACT_PROMPT}\n\nContext to compact:\n${item.context}` }],
    });

    const text_block = result.content.find(b => b.type === 'text');
    if (!text_block || text_block.type !== 'text') return { compacted: false, error: 'empty ai response' };

    let raw = text_block.text.trim();
    if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

    const parsed: { summary: string } = JSON.parse(raw);
    const kept_context = entries.slice(-3).join('\n\n');
    await compact_suggestion_context(id, parsed.summary, kept_context);

    return { compacted: true };
  } catch {
    // Non-fatal — proceed with append even if compaction fails
    return { compacted: false, error: 'compaction failed' };
  }
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

    // Auto-compact if context is large (non-fatal if it fails)
    const compact_result = await maybe_auto_compact(id);

    const updated = await append_suggestion_context(id, agent.trim(), entry.trim());

    if (!updated) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Context appended',
      ...(compact_result.compacted ? { auto_compacted: true } : {}),
    }, { headers: cors_headers() });
  } catch (error) {
    console.error('POST context_append error:', error);
    return NextResponse.json({ error: 'Failed to append context' }, { status: 500, headers: cors_headers() });
  }
}
