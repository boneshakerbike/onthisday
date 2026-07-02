/**
 * API route: POST /api/clean-text
 * Uses Sonnet (see MODELS.CLEAN_TEXT) to clean up rough text for clarity and readability
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '@/lib/models';

// Substack generation with vision can run long; Vercel Pro allows up to 300s.
export const maxDuration = 300;

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
    const { content, mode } = body;

    if (mode === 'substack') {
      const { story_text, images } = body;

      if (!story_text || typeof story_text !== 'string' || !story_text.trim()) {
        return NextResponse.json({ error: 'story_text is required' }, { status: 400 });
      }

      if (images !== undefined) {
        const valid_media_types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!Array.isArray(images) || images.length > 5 || !images.every(
          (img: { data: unknown; media_type: unknown }) =>
            typeof img.data === 'string' && valid_media_types.includes(img.media_type as string)
        )) {
          return NextResponse.json({ error: 'Invalid images payload' }, { status: 400 });
        }
      }

      const client = new Anthropic({ apiKey: api_key });

      const prompt_text = `You will be acting as a creative story generator that helps users transform their experiences into engaging Substack narratives.

## Story Input

<story>
${story_text.trim()}
</story>

<images>
${images && images.length > 0 ? 'See the images attached above in this message.' : 'No images provided.'}
</images>

## Story Generation Instructions

Transform the story above into a polished Substack post following these guidelines:

**Narrative Structure:**
- Preserve the author's structure and flow — do not reorganize or impose a different paragraph count.
- Enhance the storytelling with vivid detail, natural pacing, and emotional resonance.
- Write as one continuous narrative with no section headers or breaks.

**Style Calibration:**
- Tone: Balance humor and seriousness (slightly more serious than funny, but with wit present)
- Voice: Conversational, diary-like, simple, straightforward (casual but not sloppy)
- Attitude: Courteous with occasional irreverence or sarcasm (mostly respectful)
- Energy: Show clear enthusiasm for outdoor life and meaningful moments, but keep it direct and understated (more matter-of-fact than gushing)

**Audience:**
Write for friends, family, and outdoor enthusiasts. The story should feel like sharing an experience over a beer or during a trail break.

**Length and Format:**
- Total word count: 200-350 words
- Keep technical explanations to 1-2 sentences maximum
- Use continuous narrative flow
- Replace em dashes with ellipses or commas
- No emojis
- Vary sentence length and rhythm intentionally
- Allow occasional quirks, fragmented thoughts, or imperfect phrasing to sound natural and human

**Humor and Mood:**
- Use witty humor throughout
- Lean into absurd or unexpected details with playful commentary
- Do not undercut genuinely serious or emotional moments with jokes
- You may add light personal color or exaggeration for comedic effect

**Optional Enhancements:**
- Include short bursts of researched detail about locations, events, or outdoor trivia if relevant
- If images are provided, reference them naturally in the story

**Ending:**
Always conclude with a reflective, meaningful takeaway that conveys appreciation or gratitude in a subtle, grounded way. The closing thought should feel original and lived-in, not like a slogan or aphorism. Avoid formulaic wisdom, inspirational clichEs, or stock structures. Aim for a quiet insight that deepens the moment rather than summarizing it. Avoid cliche words like "maybe".

**Required Output Format:**

Present your story using the following exact format:

Title: [Write a 2-5 word title that is witty and sparks curiosity]
Sub Title: [Write a 2-5 word subtitle that is funny or ironic]

[Write the complete narrative here following all guidelines above. Do not use any tags.]

captions

[If images were provided, create a bulleted list of short witty captions for each image. Format as "Image 1: [Caption]", "Image 2: [Caption]"]

[If no images were provided, write "No images provided."]`;

      const content_blocks: Anthropic.MessageParam['content'] = [];

      if (images && images.length > 0) {
        for (const img of images) {
          content_blocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: img.media_type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
              data: img.data,
            },
          });
        }
      }

      content_blocks.push({ type: 'text', text: prompt_text });

      const substack_result = await client.messages.create({
        model: MODELS.SUBSTACK,
        max_tokens: 10000,
        thinking: { type: 'disabled' },
        messages: [{ role: 'user', content: content_blocks }],
      });

      const substack_raw = substack_result.content[0].type === 'text'
        ? substack_result.content[0].text.trim()
        : '';
      const substack_text = substack_raw
        .replace(/\s*—\s*/g, ', ')
        .replace(/\s*–\s*/g, ', ');

      return NextResponse.json({
        success: true,
        substack: substack_text,
        usage: {
          input_tokens: substack_result.usage.input_tokens,
          output_tokens: substack_result.usage.output_tokens,
        },
      });
    }

    const operation: 'story' | 'clarify' | 'clean' =
      mode === 'story' ? 'story' : mode === 'clarify' ? 'clarify' : 'clean';

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (content.length > 20000) {
      return NextResponse.json({ error: 'Content too large (max 20,000 characters)' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: api_key });

    let prompt_text: string;
    switch (operation) {
      case 'story':
        prompt_text = `Turn the following text into a short narrative in exactly three distinct paragraphs:
1) Intro/setup
2) Conflict or confusion
3) How it ended (resolution)

Preserve the original meaning, facts, voice, and grammatical person — if the text uses "I", keep it first person. Do not add major new details. Improve flow and clarity. Do not use em dashes — use commas, ellipses, or semicolons instead.

Return only the story text as exactly three paragraphs. No commentary, no quotes, no headings.

Text:
${content}`;
        break;
      case 'clarify':
        prompt_text = `Rewrite the following text so the meaning is unmistakable. Fix all spelling, grammar, and punctuation errors. You may go further than a simple cleanup: split or merge sentences, surface implicit logic, and reorder ideas so the point lands clearly. Keep the author's voice and tone — don't make it sound corporate or robotic. Do not invent new facts, names, or details. Do not use em dashes — use commas, ellipses, or semicolons instead.

Return only the clarified text. No commentary, no quotes, no preamble.

Text:
${content}`;
        break;
      default:
        prompt_text = `Rewrite the following text so it reads naturally and is easy to understand. Fix all spelling, grammar, and punctuation errors. Keep the author's voice and tone — don't make it sound corporate or robotic. If a sentence is confusing, rewrite it simply instead of just rearranging words. Keep it concise but don't cut anything important. Do not use em dashes — use commas, ellipses, or semicolons instead.

Return only the cleaned text. No commentary, no quotes, no preamble.

Text:
${content}`;
    }

    const result = await client.messages.create({
      model: MODELS.CLEAN_TEXT,
      max_tokens: 6144,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt_text }],
    });

    const cleaned_raw = result.content[0].type === 'text'
      ? result.content[0].text.trim()
      : '';
    const cleaned = cleaned_raw
      .replace(/\s*—\s*/g, ', ')
      .replace(/\s*–\s*/g, ', ');

    if (operation === 'story') {
      return NextResponse.json({
        success: true,
        story: cleaned,
        usage: {
          input_tokens: result.usage.input_tokens,
          output_tokens: result.usage.output_tokens
        }
      });
    }

    return NextResponse.json({
      success: true,
      cleaned,
      usage: {
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens
      }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Clean text error:', message);
    return NextResponse.json({ error: message || 'Failed to clean text' }, { status: 500 });
  }
}
