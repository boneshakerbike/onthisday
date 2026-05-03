/**
 * API route: POST /api/coaching/backfill
 * Generates summaries for coaching sessions that have advice_summary = null.
 * Auth-protected. Uses Haiku for summary generation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '@/lib/models';
import { get_client, ensure_schema } from '@/lib/db';

async function generate_summary(conversation: string): Promise<string | null> {
  const api_key = process.env.ANTHROPIC_API_KEY;
  if (!api_key) return null;

  try {
    const client = new Anthropic({ apiKey: api_key });
    const response = await client.messages.create({
      model: MODELS.COACHING_REFINE,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Summarize this coaching session in 2-3 sentences. Focus on: what was the main advice, any flags raised, and what was prescribed for today. No preamble.\n\n${conversation}`,
      }],
    });
    const content = response.content[0];
    return content.type === 'text' ? content.text : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request });
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    await ensure_schema();
    const db = get_client();

    const result = await db.execute({
      sql: `SELECT date, advice_full FROM coaching_history WHERE advice_summary IS NULL ORDER BY date ASC`,
      args: [],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ ok: true, backfilled: 0, message: 'No sessions need backfill' });
    }

    let backfilled = 0;
    const results: { date: number; success: boolean }[] = [];

    for (const row of result.rows) {
      const date = Number(row.date);
      const advice_full = row.advice_full as string;

      const summary = await generate_summary(advice_full);
      if (summary) {
        await db.execute({
          sql: `UPDATE coaching_history SET advice_summary = ? WHERE date = ?`,
          args: [summary, date],
        });
        backfilled++;
        results.push({ date, success: true });
      } else {
        results.push({ date, success: false });
      }
    }

    return NextResponse.json({ ok: true, backfilled, total: result.rows.length, results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backfill failed' },
      { status: 500 }
    );
  }
}
