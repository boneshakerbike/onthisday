/**
 * API route: POST /api/knowledge-diff
 * Compares two knowledge documents and identifies gaps
 * Uses Sonnet for analysis, Haiku for merge output
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
    const { old_doc, new_doc, use_opus } = await request.json();

    if (!old_doc || !new_doc) {
      return NextResponse.json(
        { error: 'Both old_doc and new_doc are required' },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey: api_key });

    // Step 1: Use Sonnet to analyze for gaps
    const analysis_prompt = `You are a Data Loss Auditor. Your ONLY job is finding information present in the OLD document but missing from the NEW document.

You are not evaluating quality. You are not suggesting improvements. You are hunting for deletions and losses.

IMPORTANT DISTINCTIONS:
- A VALUE CHANGE is NOT a loss (e.g., "PHP 8.2.28" → "PHP 8.2.30" is an update, not a loss)
- A COMPLETED TASK is NOT a loss (e.g., "[ ] Do X" → "[x] Do X" is progress, not a loss)
- A RESOLVED ITEM moving sections is NOT a loss
- ACTUAL LOSS: Information, facts, decisions, or details that exist in OLD but have no equivalent in NEW

Analyze both documents carefully. For each piece of information in OLD, verify it exists (or was intentionally updated/completed) in NEW.

If you find NO losses, respond with exactly:
NO_GAPS_FOUND

If you find gaps, respond with:
GAPS_FOUND
Then list each gap in this format:
---
SECTION: [which section it belongs in]
CONTENT: [the exact content that was lost]
CONTEXT: [brief note on why this seems like a loss vs intentional removal]
---

OLD DOCUMENT:
${old_doc}

NEW DOCUMENT:
${new_doc}`;

    const analysis = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: analysis_prompt }
      ]
    });

    const analysis_text = analysis.content[0].type === 'text'
      ? analysis.content[0].text.trim()
      : '';

    // Check if no gaps found
    if (analysis_text.startsWith('NO_GAPS_FOUND')) {
      return NextResponse.json({
        success: true,
        complete: true,
        message: 'New document is complete. No knowledge loss detected.',
        usage: {
          analysis_input: analysis.usage.input_tokens,
          analysis_output: analysis.usage.output_tokens,
          merge_input: 0,
          merge_output: 0
        }
      });
    }

    // Step 2: Gaps found - use Haiku (or Opus) to produce merged document
    const merge_model = use_opus ? 'claude-opus-4-5-20251101' : 'claude-3-5-haiku-20241022';

    const merge_prompt = `You are a Document Merger. Your job is to take a NEW document and insert missing content from an analysis.

The analysis below identifies content that was in an OLD version but missing from NEW. Insert each piece of missing content into the appropriate section of the NEW document.

RULES:
- Preserve the NEW document's structure exactly
- Insert missing content in the appropriate sections as identified
- Do not summarize or paraphrase - use exact content from the gaps
- Do not add commentary or explanations
- Output ONLY the complete merged document, nothing else

GAPS ANALYSIS:
${analysis_text}

NEW DOCUMENT TO MERGE INTO:
${new_doc}

Output the complete merged document:`;

    const merge = await client.messages.create({
      model: merge_model,
      max_tokens: 16000,
      messages: [
        { role: 'user', content: merge_prompt }
      ]
    });

    const merged_doc = merge.content[0].type === 'text'
      ? merge.content[0].text.trim()
      : '';

    return NextResponse.json({
      success: true,
      complete: false,
      message: 'Gaps found and merged. Use the document below.',
      gaps_found: analysis_text,
      merged_document: merged_doc,
      usage: {
        analysis_input: analysis.usage.input_tokens,
        analysis_output: analysis.usage.output_tokens,
        merge_input: merge.usage.input_tokens,
        merge_output: merge.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Knowledge diff error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compare documents' },
      { status: 500 }
    );
  }
}
