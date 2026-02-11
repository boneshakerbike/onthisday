/**
 * API route: POST /api/knowledge-diff
 * Two-step knowledge loss detection:
 *   step=analyze: Compare docs, identify what would be lost
 *   step=appendix: Generate appendix to preserve lost knowledge
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  const api_key = process.env.ANTHROPIC_API_KEY;

  if (!api_key) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { step = 'analyze', old_doc, new_doc, analysis, use_opus } = body;

    // Size limit: 200KB per document
    const MAX_DOC_LENGTH = 200000;
    if (old_doc?.length > MAX_DOC_LENGTH || new_doc?.length > MAX_DOC_LENGTH) {
      return NextResponse.json(
        { error: `Documents must be under ${MAX_DOC_LENGTH / 1000}KB each` },
        { status: 413 }
      );
    }

    const client = new Anthropic({ apiKey: api_key });

    if (step === 'analyze') {
      if (!old_doc || !new_doc) {
        return NextResponse.json(
          { error: 'Both old_doc and new_doc are required' },
          { status: 400 }
        );
      }

      // Prompt Library: "Knowledge Diff - Analysis" — update library if this changes
      const prompt = `Compare these two versions of a document. The OLD version is being replaced with the NEW version.

Identify any knowledge, information, or details from the OLD document that would be LOST in the replacement.

NOT a loss: updated values (e.g. version numbers), completed/removed tasks, reorganized content that's still present, new additions in NEW.

IS a loss: missing facts, dropped URLs/commands/configs, procedures collapsed into vague summaries, removed sections with no equivalent.

If nothing meaningful would be lost:
NO_LOSS
[Brief summary of what you checked]

If knowledge would be lost, list each item with the exact detail from OLD needed to recover it:
KNOWLEDGE_LOSS
[Each specific item that would be lost]

OLD DOCUMENT:
${old_doc}

NEW DOCUMENT:
${new_doc}`;

      const result = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }]
      });

      const text = result.content[0].type === 'text'
        ? result.content[0].text.trim()
        : '';

      // Check NO_LOSS first (more specific, avoids substring collision with KNOWLEDGE_LOSS)
      const has_losses = !text.includes('NO_LOSS');

      return NextResponse.json({
        success: true,
        has_losses,
        analysis: text,
        usage: {
          input: result.usage.input_tokens,
          output: result.usage.output_tokens
        }
      });
    }

    if (step === 'appendix') {
      if (!old_doc || !analysis) {
        return NextResponse.json(
          { error: 'old_doc and analysis are required for appendix step' },
          { status: 400 }
        );
      }

      const model = use_opus ? 'claude-opus-4-5-20251101' : 'claude-sonnet-4-20250514';

      // Prompt Library: "Knowledge Diff - Appendix" — update library if this changes
      const prompt = `Knowledge is being lost when replacing an old document with a new version. Write a concise appendix that preserves the missing knowledge.

WHAT'S MISSING:
${analysis}

SOURCE (old document with the original content):
${old_doc}

Write only the appendix content, ready to paste at the end of the new document. Preserve all specific details — exact commands, URLs, config values, procedures. Be concise but complete.`;

      const result = await client.messages.create({
        model,
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }]
      });

      const text = result.content[0].type === 'text'
        ? result.content[0].text.trim()
        : '';

      return NextResponse.json({
        success: true,
        appendix: text,
        usage: {
          input: result.usage.input_tokens,
          output: result.usage.output_tokens
        }
      });
    }

    return NextResponse.json({ error: 'Invalid step' }, { status: 400 });

  } catch (error) {
    console.error('Knowledge diff error:', error);
    const is_prod = process.env.NODE_ENV === 'production';
    return NextResponse.json(
      { error: is_prod ? 'Failed to compare documents' : (error instanceof Error ? error.message : 'Failed to compare documents') },
      { status: 500 }
    );
  }
}
