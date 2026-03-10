/**
 * API route: POST /api/strip
 * Uses Haiku to strip AI wrapper text from pasted output, returning clean core content
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '@/lib/models';

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
      model: MODELS.STRIP,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Extract only the core instruction or content from this text. Remove all AI wrapper text: introductory phrases ("Here's a prompt...", "Sure! Here is...", "Here's how..."), explanatory preamble, closing remarks ("Let me know if...", "Feel free to...", "Paste that into..."), separator lines (---), and conversational framing. Return only the clean core content with no commentary, no quotes around it.

TEXT:
${content}`
        }
      ]
    });

    const stripped = result.content[0].type === 'text'
      ? result.content[0].text.trim()
      : '';

    return NextResponse.json({
      success: true,
      stripped,
      usage: {
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Strip error:', error);
    const is_prod = process.env.NODE_ENV === 'production';
    return NextResponse.json(
      { error: is_prod ? 'Failed to strip content' : (error instanceof Error ? error.message : 'Failed to strip content') },
      { status: 500 }
    );
  }
}
