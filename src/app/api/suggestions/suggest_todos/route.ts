/**
 * API route: /api/suggestions/suggest_todos
 * Ask Haiku to suggest actionable todos from item context/content/plan
 *
 * POST - Suggest todos (auth required — session or X-Guest-Pin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import Anthropic from '@anthropic-ai/sdk';
import { get_suggestion } from '@/lib/db';

export const maxDuration = 30;

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

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: cors_headers(request.headers.get('origin')) });
}

export async function POST(request: NextRequest) {
  const auth_error = await require_auth(request);
  if (auth_error) return auth_error;

  try {
    const { id } = await request.json();
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: cors_headers() });
    }

    const item = await get_suggestion(id);
    if (!item) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404, headers: cors_headers() });
    }

    const api_key = process.env.ANTHROPIC_API_KEY;
    if (!api_key) {
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 503, headers: cors_headers() });
    }

    const parts: string[] = [];
    if (item.content) parts.push(`Description: ${item.content}`);
    if (item.plan) parts.push(`Plan:\n${item.plan}`);
    if (item.context) parts.push(`Context:\n${item.context}`);

    if (parts.length === 0) {
      return NextResponse.json({ error: 'Item has no content to analyze' }, { status: 400, headers: cors_headers() });
    }

    const prompt = `You are reviewing a project item and suggesting actionable next steps as todo items.

${parts.join('\n\n')}

Suggest 3-7 concrete, actionable todos for this item. Each must be a single short sentence (under 200 characters), like a git commit subject line. Classify each as "bug", "feature", or "task".

Return valid JSON only: {"todos": [{"text": "...", "type": "bug|feature|task"}, ...]}`;

    const client = new Anthropic({ apiKey: api_key });
    const result = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text_block = result.content.find(b => b.type === 'text');
    if (!text_block || text_block.type !== 'text') {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500, headers: cors_headers() });
    }

    let raw = text_block.text.trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    let parsed: { todos: Array<{ text: string; type: string }> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500, headers: cors_headers() });
    }

    // Validate and clamp to 200 chars
    const todos = (parsed.todos || [])
      .filter((t): t is { text: string; type: string } => typeof t.text === 'string' && t.text.trim().length > 0)
      .map(t => ({
        text: t.text.trim().slice(0, 200),
        type: ['bug', 'feature', 'task'].includes(t.type) ? t.type as 'bug' | 'feature' | 'task' : 'task' as const,
      }));

    return NextResponse.json({ success: true, todos }, { headers: cors_headers() });
  } catch (error) {
    console.error('POST suggest_todos error:', error);
    return NextResponse.json({ error: 'Failed to suggest todos' }, { status: 500, headers: cors_headers() });
  }
}
