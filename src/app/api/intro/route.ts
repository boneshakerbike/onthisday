/**
 * API route: POST /api/intro
 * Generates a short intro paragraph for the copy feature using Haiku (fast & cheap)
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

interface PostSummary {
  year: number;
  title: string;
  blurb: string | null;
}

export async function POST(request: NextRequest) {
  const api_key = process.env.ANTHROPIC_API_KEY;

  if (!api_key) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 500 }
    );
  }

  try {
    const { date_display, posts } = await request.json() as {
      date_display: string;
      posts: PostSummary[];
    };

    if (!date_display || !posts || posts.length === 0) {
      return NextResponse.json(
        { error: 'date_display and posts are required' },
        { status: 400 }
      );
    }

    // Calculate year span
    const years = posts.map(p => p.year).sort((a, b) => a - b);
    const earliest_year = years[0];
    const latest_year = years[years.length - 1];
    const year_span = latest_year - earliest_year;

    // Build minimal context for the AI
    const post_summaries = posts.map(p =>
      `${p.year}: "${p.title}"${p.blurb ? ` - ${p.blurb.slice(0, 100)}` : ''}`
    ).join('\n');

    const prompt = `Write a SHORT 2-sentence intro (30-40 words max) for an "On This Day" post.

Date: ${date_display}
Posts: ${posts.length} posts, ${year_span > 0 ? `${earliest_year}-${latest_year}` : earliest_year}
Topics: ${post_summaries}

Format:
1. First sentence: "${date_display} has shown up [X] times since [year]."
2. Second sentence: Brief, wry observation about the themes. Use ellipses to list 2-3 topics if needed.

Tone: Understated, gently self-aware. No purple prose. No "anthology" or "tapestry" or fancy metaphors.
Output ONLY the intro, nothing else.`;

    const client = new Anthropic({ apiKey: api_key });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-latest',
      max_tokens: 150,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    return NextResponse.json({
      success: true,
      intro: content.text.trim(),
      usage: {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Intro generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate intro' },
      { status: 500 }
    );
  }
}
