/**
 * API route: POST /api/coaching/finalize
 * Saves the coaching session's final advice to coaching_history.
 * Optionally generates a compressed summary via Haiku for long-term storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { save_coaching_session, populate_daily_metrics } from '@/lib/coaching/db';

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request });
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { date, date_str, advice_full, advice_summary, conversation_turns, token_count, manual } = body as {
      date: number;
      date_str: string;
      advice_full: string;
      advice_summary?: string;
      conversation_turns: number;
      token_count: number;
      manual?: { weight_lbs?: number; back_pain_scale?: number; back_mobility_notes?: string; bowel_status?: string; injury_notes?: string };
    };

    if (!date || !advice_full) {
      return NextResponse.json({ error: 'date and advice_full are required' }, { status: 400 });
    }

    // Save coaching session and populate daily_metrics in parallel
    await Promise.all([
      save_coaching_session({
        date,
        advice_full,
        advice_summary: advice_summary ?? null,
        conversation_turns,
        token_count,
      }),
      date_str ? populate_daily_metrics(date_str, date, manual) : Promise.resolve(),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Finalize failed' },
      { status: 500 }
    );
  }
}
