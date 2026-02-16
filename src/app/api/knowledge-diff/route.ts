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
      const prompt = `Compare OLD vs NEW. Identify only knowledge that is VERIFIED missing from NEW.

Preflight:
- OLD chars: ${old_doc.length}, OLD lines: ${old_doc.split('\n').length}
- NEW chars: ${new_doc.length}, NEW lines: ${new_doc.split('\n').length}
- First 3 lines of OLD and NEW (verify you received the full documents)
- Last 3 lines of OLD and NEW (verify documents are not truncated)
If NEW chars < 0.6 * OLD chars, or if last lines look cut off, output:
INPUT_TRUNCATION_OR_WRONG_DOC
and stop.

Rules:
- NOT a loss: reorganized content still present, updated values, completed tasks, additions in NEW
- IS a loss: facts present in OLD that do not exist anywhere in NEW
- No "appears to be" reasoning. Only diff and search based claims.

If nothing meaningful is lost:
NO_LOSS
[brief summary of checks]

If loss exists:
KNOWLEDGE_LOSS
For each item include:
- LABEL: short description
- SECTION: the header where it came from in OLD
- OLD_QUOTE: (1 to 3 exact lines from OLD)
- ABSENT_CHECK: exact string searched in NEW and "not found"
- RECOVERY_NOTE: how to re-add it (1 sentence)

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

      // Check for truncation detection first
      const truncation_detected = text.includes('INPUT_TRUNCATION_OR_WRONG_DOC');
      if (truncation_detected) {
        return NextResponse.json({
          success: true,
          truncation_detected: true,
          has_losses: false,
          analysis: text,
          usage: {
            input: result.usage.input_tokens,
            output: result.usage.output_tokens
          }
        });
      }

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
      const prompt = `Write an appendix ONLY for facts that are VERIFIED missing from NEW.

Input is VERIFIED_LOSSES. Each item must include:
- LABEL
- SECTION
- OLD_QUOTE (exact)
- ABSENT_CHECK (string not found in NEW)

If VERIFIED_LOSSES is empty, output exactly:
NO_LOSS

Otherwise:
Write only the appendix content, ready to paste at end of NEW.
Rules:
- Include ONLY items from VERIFIED_LOSSES
- Preserve exact details (URLs, file paths, IPs, commands, procedures)
- Do NOT invent or guess
- Do NOT restate content already present in NEW

VERIFIED_LOSSES:
${analysis}`;

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
