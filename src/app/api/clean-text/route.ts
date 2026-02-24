/**
 * API route: POST /api/clean-text
 * Uses Sonnet to clean up rough text for clarity, correctness, and conciseness
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import Anthropic from '@anthropic-ai/sdk';

async function require_auth(request: NextRequest): Promise<NextResponse | null> {
  const token = await getToken({ req: request });
  if (token) return null;

  const pin_header = request.headers.get('X-Guest-Pin');
  if (pin_header) {
    const valid_pins = (process.env.GUEST_PINS || process.env.GUEST_PIN || '')
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);
    if (valid_pins.includes(pin_header)) return null;
  }

  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const auth_error = await require_auth(request);
  if (auth_error) return auth_error;

  const api_key = process.env.ANTHROPIC_API_KEY;
  if (!api_key) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (content.length > 20000) {
      return NextResponse.json({ error: 'Content too large (max 20,000 characters)' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: api_key });

    const result = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are an expert editor. Please review the following text and improve it for clarity, correctness, and conciseness while preserving all essential information.

Your tasks:
1. Correct all spelling, grammar, and punctuation errors
2. Clarify unclear or ambiguous phrases
3. Streamline wordy sections without losing meaning
4. Improve sentence structure and flow

Return only the cleaned text with no commentary, no quotes around it, no preamble.

Text to edit:
${content}`
        }
      ]
    });

    const cleaned = result.content[0].type === 'text'
      ? result.content[0].text.trim()
      : '';

    return NextResponse.json({
      success: true,
      cleaned,
      usage: {
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Clean text error:', error);
    const is_prod = process.env.NODE_ENV === 'production';
    return NextResponse.json(
      { error: is_prod ? 'Failed to clean text' : (error instanceof Error ? error.message : 'Failed to clean text') },
      { status: 500 }
    );
  }
}
