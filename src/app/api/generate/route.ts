/**
 * API route: POST /api/generate
 * Generates a "looking back" story from posts on a given date using Claude
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { get_posts_on_date, get_post_url } from '@/lib/db';

export async function POST(request: NextRequest) {
  const api_key = process.env.ANTHROPIC_API_KEY;

  if (!api_key) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 500 }
    );
  }

  try {
    const { month, day } = await request.json();

    if (!month || !day) {
      return NextResponse.json(
        { error: 'month and day are required' },
        { status: 400 }
      );
    }

    const posts = await get_posts_on_date(month, day);

    if (posts.length === 0) {
      return NextResponse.json(
        { error: 'No posts found for this date' },
        { status: 404 }
      );
    }

    // Format posts for the prompt
    const formatted_posts = posts.map(post => {
      // Strip HTML tags from content
      let plain_text = '';
      if (post.content_html) {
        plain_text = post.content_html
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
      }

      return `## ${post.year}: ${post.title}
URL: ${get_post_url(post.post_id)}
${post.years_ago === 0 ? '(this year)' : post.years_ago === 1 ? '(1 year ago)' : `(${post.years_ago} years ago)`}

${plain_text || post.blurb || '(no content available)'}
`;
    }).join('\n---\n\n');

    // Format the date for display
    const date_display = new Date(2000, month - 1, day).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric'
    });

    const prompt = `You are writing an "On This Day" reflection post for my Substack newsletter.

BASE VOICE (from story generation style):
- Tone: Balance humor with insight (target 3 on Funny vs. Serious)
- Style: Conversational, diary-like, straightforward (target 4 on Formal vs. Casual)
- Respect: Courteous with light irreverence (target 2 on Respectful vs. Irreverent)
- Energy: Clear enthusiasm for outdoor life, direct delivery (target 2 on Enthusiastic vs. Matter of Fact)
- Replace em dashes with ellipses or commas
- No emojis
- Intentional sentence rhythm variation

ADAPTIVE VOICE REFINEMENT:
First, analyze the provided posts for recurring themes, word choices, and tonal patterns. Subtly adjust the base voice to echo these detected nuances while maintaining the core style parameters above.

CONTENT STRUCTURE:
1. Creative title incorporating "${date_display}" (3-6 words total, quirky and curiosity-sparking)
   Examples: "Why March 15th?" or "January 30th Blues" or "October 12th Strikes Again"
2. Weave themes from posts showing evolution/consistency
3. Natural link integration
4. Reflective ending with appreciative insight
5. 150-250 words maximum

FORMAT: HTML with <h2> title, <p> paragraphs, <a href> links

Here are my posts from ${date_display}:

${formatted_posts}`;

    const client = new Anthropic({ apiKey: api_key });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Strip markdown code fences if present
    let story = content.text.trim();
    if (story.startsWith('```html')) {
      story = story.slice(7);
    } else if (story.startsWith('```')) {
      story = story.slice(3);
    }
    if (story.endsWith('```')) {
      story = story.slice(0, -3);
    }
    story = story.trim();

    return NextResponse.json({
      success: true,
      story,
      posts_used: posts.length,
      usage: {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate story' },
      { status: 500 }
    );
  }
}
