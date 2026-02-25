/**
 * API route: /api/suggestions/compact
 * Manual context compaction with preview — admin only
 * Calls Haiku to generate a summary + extract todos from context history
 *
 * POST - Compact context (admin only)
 *   confirm=false: preview mode (returns proposed summary + todos, saves nothing)
 *   confirm=true: saves summary and appends extracted todos
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import Anthropic from '@anthropic-ai/sdk';
import {
  get_suggestion,
  set_suggestion_summary,
  add_suggestion_todo,
  TodoItem,
} from '@/lib/db';

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

const COMPACTION_PROMPT = `You are compacting a project's context history into two outputs.

OUTPUT 1 - SUMMARY: Write a concise current-state summary. Cover only what's CURRENT: what's built, what works, what's broken, key decisions still relevant. Discard completed or outdated information. Do NOT summarize any content from the plan field — that is managed separately. Max 500 words.

OUTPUT 2 - TODOS: Extract every unresolved bug, feature request, and pending task. Each item MUST be under 100 characters — one short sentence, like a git commit subject. Classify each as "bug", "feature", or "task". If you cannot express it in under 100 characters, split it into multiple items.

Return valid JSON only: {"summary": "...", "todos": [{"text": "...", "type": "bug|feature|task"}, ...]}`;

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: cors_headers(request.headers.get('origin')) });
}

export async function POST(request: NextRequest) {
  const auth_error = await require_bill(request);
  if (auth_error) return auth_error;

  try {
    const { id, confirm } = await request.json();

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: cors_headers() });
    }

    const item = await get_suggestion(id);
    if (!item) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404, headers: cors_headers() });
    }

    if (!item.context || item.context.trim().length === 0) {
      return NextResponse.json({ error: 'No context to compact' }, { status: 400, headers: cors_headers() });
    }

    const api_key = process.env.ANTHROPIC_API_KEY;
    if (!api_key) {
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 503, headers: cors_headers() });
    }

    const overflow = item.context.length > 30000;

    // Call Haiku for compaction
    const client = new Anthropic({ apiKey: api_key });
    const result = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `${COMPACTION_PROMPT}\n\nContext to compact:\n${item.context}`,
      }],
    });

    const text_block = result.content.find(b => b.type === 'text');
    if (!text_block || text_block.type !== 'text') {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500, headers: cors_headers() });
    }

    // Parse JSON from response (handle markdown code blocks)
    let raw_text = text_block.text.trim();
    if (raw_text.startsWith('```')) {
      raw_text = raw_text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    let parsed: { summary: string; todos: { text: string; type: string }[] };
    try {
      parsed = JSON.parse(raw_text);
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON', raw: raw_text }, { status: 500, headers: cors_headers() });
    }

    const new_todos = (parsed.todos || []).map(t => ({
      text: t.text.slice(0, 100),
      type: ['bug', 'feature', 'task'].includes(t.type) ? t.type : 'task',
    }));

    if (!confirm) {
      // Preview mode — return proposed changes, save nothing
      return NextResponse.json({
        success: true,
        preview: true,
        summary: parsed.summary,
        new_todos,
        overflow,
      }, { headers: cors_headers() });
    }

    // Confirm mode — save summary and append todos
    await set_suggestion_summary(id, parsed.summary);

    for (const t of new_todos) {
      const todo: TodoItem = {
        id: generate_todo_id(),
        text: t.text,
        type: t.type as TodoItem['type'],
        done: false,
        added_by: 'compact',
        created_at: new Date().toISOString(),
      };
      await add_suggestion_todo(id, todo);
    }

    return NextResponse.json({
      success: true,
      saved: true,
      summary: parsed.summary,
      new_todos,
      overflow,
    }, { headers: cors_headers() });
  } catch (error) {
    console.error('POST compact error:', error);
    return NextResponse.json({ error: 'Failed to compact context' }, { status: 500, headers: cors_headers() });
  }
}
