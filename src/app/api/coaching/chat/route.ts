/**
 * API route: POST /api/coaching/chat
 * Multi-turn coaching conversation with cached system prompt.
 * Receives conversation history + user message, returns coaching response + usage stats.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '@/lib/models';
import { COACHING_SYSTEM_PROMPT } from '@/lib/coaching/system-prompt';
import { get_recent_sessions } from '@/lib/coaching/db';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_TURNS = 10;

/**
 * Build a session-history context block from recent coaching sessions.
 * Kept short — summaries preferred, full text as fallback, capped at ~600 tokens.
 */
async function build_session_context(): Promise<string | null> {
  const sessions = await get_recent_sessions(3);
  if (sessions.length === 0) return null;

  const lines: string[] = ['RECENT COACHING SESSIONS (for continuity — do not repeat advice already given):'];
  for (const s of sessions) {
    const date = new Date(s.date * 86400000).toISOString().split('T')[0];
    const text = s.advice_summary || s.advice_full;
    // Truncate to ~200 chars per session to stay within budget
    const truncated = text.length > 200 ? text.slice(0, 200) + '...' : text;
    lines.push(`\n[${date}] (${s.conversation_turns} turns):`);
    lines.push(truncated);
  }
  return lines.join('\n');
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request });
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const api_key = process.env.ANTHROPIC_API_KEY;
  if (!api_key) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { conversation_history, user_message } = body as {
      conversation_history: ChatMessage[];
      user_message: string;
    };

    if (!user_message || typeof user_message !== 'string') {
      return NextResponse.json({ error: 'user_message is required' }, { status: 400 });
    }

    const history = Array.isArray(conversation_history) ? conversation_history : [];

    if (history.length >= MAX_TURNS * 2) {
      return NextResponse.json(
        { error: 'Maximum conversation length reached. Please finalize your session.' },
        { status: 400 }
      );
    }

    // Fetch session history only on first message (no prior conversation)
    const session_context = history.length === 0 ? await build_session_context() : null;

    const system_blocks: Anthropic.TextBlockParam[] = [
      {
        type: 'text',
        text: COACHING_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ];

    if (session_context) {
      system_blocks.push({
        type: 'text',
        text: session_context,
      });
    }

    const messages: ChatMessage[] = [
      ...history,
      { role: 'user', content: user_message },
    ];

    const client = new Anthropic({ apiKey: api_key });

    const response = await client.messages.create({
      model: MODELS.COACHING_DAILY,
      max_tokens: 1024,
      system: system_blocks,
      messages,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    return NextResponse.json({
      response: content.text,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cache_creation_input_tokens: (response.usage as any).cache_creation_input_tokens ?? 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cache_read_input_tokens: (response.usage as any).cache_read_input_tokens ?? 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}
