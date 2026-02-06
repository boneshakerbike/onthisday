/**
 * API route: POST /api/prompts/review
 * Uses Sonnet to review a prompt and suggest improvements
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
    const { content, issue } = await request.json();

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Prompt content is required' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: api_key });

    const review = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You are a Prompt Engineering Advisor. Analyze this prompt and suggest concrete improvements.

First, identify the prompt's **interaction pattern**:
- How does it expect to receive input? (content appended at end, AI asks for it, self-contained, etc.)
- Does it use questions as a guiding technique, or are they fill-in fields?
- Is it designed for a chat interface, a template, or something else?

State your assessment of the interaction pattern briefly before diving into suggestions.
${issue ? `\nThe author has flagged this specific concern:\n> ${issue}\n\nPrioritize suggestions that address this concern.\n` : ''}
Then analyze for:
1. **Clarity** - Is the intent unambiguous? Are instructions precise?
2. **Specificity** - Are constraints and requirements explicit?
3. **Structure** - Would reformatting improve readability?
4. **Edge cases** - What might the LLM misinterpret or skip?
5. **Effectiveness** - Would different phrasing get better results?

Provide 3-5 specific, actionable suggestions. For each:
- Quote the relevant section
- Explain why it matters
- Show the suggested rewrite

Then provide the complete improved prompt under this exact heading:
## IMPROVED PROMPT

PROMPT TO REVIEW:
${content}`
        }
      ]
    });

    const review_text = review.content[0].type === 'text'
      ? review.content[0].text.trim()
      : '';

    // Try to extract the improved prompt section
    let suggestions = review_text;
    let improved_prompt = '';

    const split_marker = '## IMPROVED PROMPT';
    const split_idx = review_text.indexOf(split_marker);
    if (split_idx !== -1) {
      suggestions = review_text.substring(0, split_idx).trim();
      improved_prompt = review_text.substring(split_idx + split_marker.length).trim();
    }

    return NextResponse.json({
      success: true,
      suggestions,
      improved_prompt,
      usage: {
        input_tokens: review.usage.input_tokens,
        output_tokens: review.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Prompt review error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to review prompt' },
      { status: 500 }
    );
  }
}
