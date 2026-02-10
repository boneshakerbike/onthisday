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

    // Size limit: 200KB per document
    const MAX_DOC_LENGTH = 200000;
    if (old_doc.length > MAX_DOC_LENGTH || new_doc.length > MAX_DOC_LENGTH) {
      return NextResponse.json(
        { error: `Documents must be under ${MAX_DOC_LENGTH / 1000}KB each` },
        { status: 413 }
      );
    }

    const client = new Anthropic({ apiKey: api_key });

    // Prompt Library: "Knowledge Diff - Analysis" — update library if this changes
    const analysis_prompt = `You are a meticulous Data Loss Auditor. Your job is finding information present in the OLD document but missing or inadequately represented in the NEW document — including losses of depth, structure, and functional knowledge.

## METHOD (follow these steps exactly)

**Step 1: Classify.** Go through the OLD document and classify each section by knowledge type:
- PROCEDURE: Step-by-step instructions, decision trees, workflows
- TROUBLESHOOTING: Diagnostic steps, error resolution, conditional branches
- REFERENCE: Facts, URLs, constants, version numbers, configurations
- CHECKLIST: Verification steps, monitoring items, review lists
- STRATEGY: Architecture decisions, design rationale, trade-off analysis
- HISTORICAL: Timelines, context, evolution of decisions
- EDUCATIONAL: Explanations, rationale, background knowledge

**Step 2: Inventory.** For each section, list every distinct fact, decision, configuration detail, URL, instruction, or piece of knowledge.

**Step 3: Cross-reference.** For each item from Step 2, verify it exists in the NEW document. Mark each as:
- PRESENT: Exists in NEW with equivalent depth and detail
- REPLACED: Content was replaced by something more specific or better (note what replaced it)
- MOVED: Content moved to a different section
- REDUCED: Content exists but lost procedural depth, steps, or operational detail
- LOST: Content is missing with no equivalent

**Step 4: Structural check.** Compare knowledge types present in OLD vs NEW. Flag if an entire knowledge type class has disappeared or been severely reduced.

**Step 5: Report.** Based on your cross-reference, produce your output.

## WHAT COUNTS AS A LOSS

- A fact, URL, decision, or instruction in OLD with no equivalent in NEW = LOSS
- A specific item replaced by a vague generalization = LOSS (specificity lost)
- A configuration detail, command, or path that was dropped = LOSS
- A multi-step procedure collapsed into a summary bullet = LOSS (depth lost)
- An entire knowledge type class (e.g., all troubleshooting) removed = MAJOR LOSS

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

First, report any knowledge type losses:
KNOWLEDGE_TYPE_LOSSES:
- [TYPE]: [GONE | SEVERELY_REDUCED] — was [N sections/items], now [N or 0]
(If no type-level losses, write KNOWLEDGE_TYPE_LOSSES: NONE)

Then list each gap:
---
SEVERITY: [MAJOR or MINOR]
TYPE: [PROCEDURE | TROUBLESHOOTING | REFERENCE | CHECKLIST | STRATEGY | HISTORICAL | EDUCATIONAL]
SECTION: [which section in OLD it belongs to]
CONTENT: [the exact content that was lost]
CONTEXT: [why this is a loss, not an intentional change]
---

MAJOR = meaningful knowledge, decisions, technical details, or procedural depth lost
MINOR = small details, minor wording, or edge-case information

Err on the side of flagging. It is better to report a MINOR gap that turns out to be intentional than to miss a real loss.

OLD DOCUMENT:
${old_doc}

NEW DOCUMENT:
${new_doc}`;

    const analysis = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        { role: 'user', content: analysis_prompt }
      ]
    });

    const analysis_text = analysis.content[0].type === 'text'
      ? analysis.content[0].text.trim()
      : '';

    // Check for NO_GAPS_FOUND first (more specific match avoids substring collision)
    if (analysis_text.includes('NO_GAPS_FOUND')) {
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

    // Extract just the gap entries from the analysis for the merger
    // The full analysis includes cross-referencing noise (PRESENT, MOVED, REPLACED items)
    // which overwhelms the merger on large documents
    const gaps_start = analysis_text.indexOf('GAPS_FOUND');
    const gaps_section = gaps_start >= 0 ? analysis_text.substring(gaps_start) : analysis_text;
    const gap_count = (gaps_section.match(/\nSEVERITY:/g) || []).length;

    // Step 2: Gaps found - use Sonnet (or Opus) to produce merged document
    const merge_model = use_opus ? 'claude-opus-4-5-20251101' : 'claude-sonnet-4-20250514';

    // Prompt Library: "Knowledge Diff - Merge" — update library if this changes
    const merge_prompt = `You are a Document Merger. You MUST insert ${gap_count} missing items into the NEW document below.

Each gap entry has a CONTENT field — that is the exact text to insert. You MUST insert every single one. The merged document MUST be longer than the original NEW document.

RULES:
- Use the NEW document's structure as your base
- Insert each gap's CONTENT into the appropriate existing section
- If a gap's SECTION no longer exists in NEW, recreate it as "## Recovered: [Section Name]"
- Use the exact content from each gap — do not summarize or paraphrase
- Do not add commentary or explanations
- Preserve procedural depth: restore full workflows, not summaries
- Output ONLY the complete merged document, nothing else

GAPS TO INSERT (${gap_count} items):
${gaps_section}

NEW DOCUMENT TO MERGE INTO:
${new_doc}

Output the complete merged document with all ${gap_count} gaps inserted:`;

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

    // Verify the merge actually changed something
    const length_ratio = merged_doc.length / new_doc.length;
    const merge_warning = (length_ratio > 0.98 && length_ratio < 1.02)
      ? 'Warning: Merged document is nearly identical to the new document. The merger may not have inserted all gaps. Review the gaps analysis below to verify.'
      : null;

    return NextResponse.json({
      success: true,
      complete: false,
      message: merge_warning || `Gaps found and merged (${gap_count} items). Use the document below.`,
      gaps_found: analysis_text,
      merged_document: merged_doc,
      gap_count,
      merge_warning,
      usage: {
        analysis_input: analysis.usage.input_tokens,
        analysis_output: analysis.usage.output_tokens,
        merge_input: merge.usage.input_tokens,
        merge_output: merge.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Knowledge diff error:', error);
    const is_prod = process.env.NODE_ENV === 'production';
    return NextResponse.json(
      { error: is_prod ? 'Failed to compare documents' : (error instanceof Error ? error.message : 'Failed to compare documents') },
      { status: 500 }
    );
  }
}
