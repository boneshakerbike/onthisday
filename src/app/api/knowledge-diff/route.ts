/**
 * API route: POST /api/knowledge-diff
 * Compares two knowledge documents and identifies gaps
 * Uses Sonnet for analysis and merge (Opus optional for merge)
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

    // Prompt Library: "Knowledge Diff - Analysis" — update library if this changes
    const analysis_prompt = `You are a meticulous Data Loss Auditor. Your job is finding information present in the OLD document but missing or inadequately represented in the NEW document.

## METHOD (follow these steps exactly)

**Step 1: Inventory.** Go through the OLD document section by section. For each section, list every distinct fact, decision, configuration detail, URL, instruction, or piece of knowledge.

**Step 2: Cross-reference.** For each item from Step 1, verify it exists in the NEW document. Mark each as:
- PRESENT: Exists in NEW (same or updated form)
- REPLACED: Content was replaced by something more specific or better (note what replaced it)
- MOVED: Content moved to a different section
- LOST: Content is missing with no equivalent

**Step 3: Report.** Based on your cross-reference, produce your output.

## WHAT COUNTS AS A LOSS

- A fact, URL, decision, or instruction in OLD with no equivalent in NEW = LOSS
- A specific item replaced by a vague generalization = LOSS (specificity lost)
- A configuration detail, command, or path that was dropped = LOSS

## WHAT IS NOT A LOSS

- A VALUE CHANGE (e.g., "PHP 8.2.28" → "PHP 8.2.30") = update, not loss
- A COMPLETED TASK ("[ ] Do X" → "[x] Do X" or removed after completion) = not loss
- Content REORGANIZED into different sections = not loss (verify it's actually there)
- Content REPLACED by more specific/detailed items = not loss (note the replacement)

## OUTPUT FORMAT

If you find NO losses after thorough cross-referencing:
NO_GAPS_FOUND
Sections verified: [number]
Items checked: [approximate count]
Summary: [1-2 sentence summary of what was verified]

If you find ANY losses (even minor ones):
GAPS_FOUND

Then list each gap:
---
SEVERITY: [MAJOR or MINOR]
SECTION: [which section in OLD it belongs to]
CONTENT: [the exact content that was lost]
CONTEXT: [why this is a loss, not an intentional change]
---

MAJOR = meaningful knowledge, decisions, or technical details lost
MINOR = small details, minor wording, or edge-case information

Err on the side of flagging. It is better to report a MINOR gap that turns out to be intentional than to miss a real loss.

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
    // GAPS_FOUND takes priority - if both keywords appear, treat as gaps found
    const has_gaps_found = analysis_text.includes('GAPS_FOUND');
    const has_no_gaps = analysis_text.includes('NO_GAPS_FOUND');
    const no_gaps = has_no_gaps && !has_gaps_found;

    if (no_gaps) {
      return NextResponse.json({
        success: true,
        complete: true,
        message: 'New document is complete. No knowledge loss detected.',
        analysis_summary: analysis_text,
        usage: {
          analysis_input: analysis.usage.input_tokens,
          analysis_output: analysis.usage.output_tokens,
          merge_input: 0,
          merge_output: 0
        }
      });
    }

    // Step 2: Gaps found - use Sonnet (or Opus) to produce merged document
    // Note: Haiku model name was returning 404, using Sonnet as reliable fallback
    const merge_model = use_opus ? 'claude-opus-4-5-20251101' : 'claude-sonnet-4-20250514';

    // Prompt Library: "Knowledge Diff - Merge" — update library if this changes
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
