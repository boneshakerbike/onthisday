/**
 * API route: POST /api/generate
 * Generates a "looking back" story from posts on a given date using Claude
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { get_posts_on_date, get_post_url, save_story, save_story_audit } from '@/lib/db';
import { build_story_audit } from '@/lib/story_audit';

function stripCodeFences(text: string): string {
  let cleaned = text.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, '');
    cleaned = cleaned.replace(/\s*```$/, '');
  }

  return cleaned.trim();
}

function extractTagContent(response: string, tag: string): string {
  const pattern = new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*<\\/${tag}>`, 'i');
  const match = response.match(pattern);

  if (!match || !match[1]) {
    throw new Error(`Missing <${tag}> in model response`);
  }

  return match[1].trim();
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

    // Try to extract an image from the posts (first one found)
    let image_url: string | null = null;
    for (const post of posts) {
      if (post.content_html) {
        // Look for img tags with src attribute
        const img_match = post.content_html.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (img_match && img_match[1]) {
          // Skip tiny images (likely tracking pixels) and data URLs
          const src = img_match[1];
          if (!src.startsWith('data:') && !src.includes('pixel') && !src.includes('tracking')) {
            image_url = src;
            break;
          }
        }
      }
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

    // Prompt Library: "Story Generation" — update library if this changes
    const system_prompt = `You are writing an "On This Day" reflection post for my Substack newsletter.

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
1. Creative title incorporating the date (3-6 words total, quirky and curiosity-sparking)
   Examples: "Why March 15th?" or "January 30th Blues" or "October 12th Strikes Again"
2. Weave themes from posts showing evolution/consistency
3. IMPORTANT: Include a link to EVERY post provided - no exceptions. Each URL must appear EXACTLY ONCE (no duplicates)
4. Reflective ending with appreciative insight
5. 150-300 words (scale with post count: ~30 words per post minimum)

FORMAT:
- Return exactly this structure with no markdown fences:
<response>
<story><h2>Title</h2><p>...</p></story>
<blurb>Two to three plain-text sentences that summarize the story for sharing.</blurb>
</response>
- story must be HTML with <h2> title, <p> paragraphs, <a href> links
- blurb must be plain text only, no HTML, no markdown`;

    // User message (dynamic) - changes with each request
    const user_message = `Write a reflection for ${date_display}. Here are my posts from this date:

${formatted_posts}`;

    const client = new Anthropic({ apiKey: api_key });

    const message = await client.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: system_prompt,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [
        { role: 'user', content: user_message }
      ]
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const response_text = stripCodeFences(content.text);
    const story = extractTagContent(response_text, 'story');
    const blurb = extractTagContent(response_text, 'blurb')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!story || !blurb) {
      throw new Error('Incomplete model response');
    }

    // Save story to database and get shareable ID
    const date_key = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const story_id = await save_story(date_key, date_display, story, blurb, posts.length, image_url);
    const audit = build_story_audit(posts.map(post => ({
      post_id: post.post_id,
      title: post.title,
      url: get_post_url(post.post_id),
      content_html: post.content_html
    })));
    await save_story_audit(story_id, audit);

    return NextResponse.json({
      success: true,
      story,
      blurb,
      story_id,
      audit,
      posts_used: posts.length,
      usage: {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
        cache_creation_input_tokens: (message.usage as unknown as Record<string, number>).cache_creation_input_tokens || 0,
        cache_read_input_tokens: (message.usage as unknown as Record<string, number>).cache_read_input_tokens || 0
      }
    });

  } catch (error) {
    console.error('Generate error:', error);
    const is_prod = process.env.NODE_ENV === 'production';
    return NextResponse.json(
      { error: is_prod ? 'Failed to generate story' : (error instanceof Error ? error.message : 'Failed to generate story') },
      { status: 500 }
    );
  }
}
