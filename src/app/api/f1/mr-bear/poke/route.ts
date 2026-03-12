/**
 * Poke the Bear — generate and save Mr Bear's picks for a weekend.
 * Admin only (GitHub OAuth, not guest).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { auth_options } from '@/lib/auth';
import {
  get_roster, get_prediction, save_prediction,
  lock_prediction, set_player_state,
  get_cached_results, delete_prediction_and_score, delete_player_state,
  delete_staged_picks,
} from '@/lib/f1/db';
import { generate_picks } from '@/lib/f1/mr_bear';
import { get_schedule } from '@/lib/f1/cache';
import type { SessionType } from '@/lib/f1/types';
import { STANDARD_WEEKEND, SPRINT_WEEKEND } from '@/lib/f1/types';

const MR_BEAR = 'Mr Bear';

export async function POST(request: NextRequest) {
  const session = await getServerSession(auth_options);
  if (!session?.user || (session.user as { id?: string }).id === 'guest') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const { season, round } = await request.json();
    if (!season || !round) {
      return NextResponse.json({ error: 'Missing season or round' }, { status: 400 });
    }

    const roster = await get_roster(season);
    if (!roster.includes(MR_BEAR)) {
      return NextResponse.json({ error: 'Add Mr Bear to the roster first' }, { status: 400 });
    }

    // Determine weekend type from schedule
    const schedule = await get_schedule(season);
    const race = schedule?.find(r => r.round === round);
    const session_types: SessionType[] = race?.is_sprint_weekend
      ? SPRINT_WEEKEND
      : STANDARD_WEEKEND;

    const generated: string[] = [];
    const skipped: string[] = [];
    const picks_result: Record<string, { p1: string; p2: string; p3: string; fastest_lap: string | null }> = {};

    for (const st of session_types) {
      // Skip if session has been revealed (results exist)
      const results = await get_cached_results(season, round, st);
      if (results) {
        skipped.push(st);
        continue;
      }

      // Delete existing prediction/score/state so we can regenerate
      const existing = await get_prediction(season, round, st, MR_BEAR);
      if (existing) {
        await delete_prediction_and_score(season, round, st, MR_BEAR);
        await delete_player_state(season, round, st, MR_BEAR);
        await delete_staged_picks(season, round, st);
      }

      const picks = await generate_picks(season, round, st);
      await save_prediction(season, round, st, MR_BEAR, picks.p1, picks.p2, picks.p3, picks.fastest_lap);
      await lock_prediction(season, round, st, MR_BEAR);
      await set_player_state(season, round, st, MR_BEAR, 'watching');

      generated.push(st);
      picks_result[st] = picks;
    }

    return NextResponse.json({ generated, skipped, picks: picks_result });
  } catch (error) {
    console.error('Poke the Bear error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate picks' },
      { status: 500 }
    );
  }
}
