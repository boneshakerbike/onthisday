import { NextRequest, NextResponse } from 'next/server';
import { refresh_schedule, reveal_session } from '@/lib/f1/cache';
import { get_roster, get_predictions_for_session } from '@/lib/f1/db';
import type { SessionType } from '@/lib/f1/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season, round, session_type, player_name } = body;

    if (!season || !round || !session_type || !player_name) {
      return NextResponse.json(
        { error: 'Missing required fields: season, round, session_type, player_name' },
        { status: 400 }
      );
    }

    const st = session_type as SessionType;

    // Group check: if roster exists, all players must have LOCKED predictions
    const roster = await get_roster(season);
    if (roster.length > 0) {
      const predictions = await get_predictions_for_session(season, round, st);
      const locked_names = new Set(predictions.filter(p => p.is_locked).map(p => p.player_name));
      const missing = roster.filter(p => !locked_names.has(p));
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Waiting for ${missing.join(', ')} to lock in predictions` },
          { status: 403 }
        );
      }
    }

    const { results, prediction, score } = await reveal_session(season, round, st, player_name);

    if (st === 'race') {
      await refresh_schedule(season);
    }

    return NextResponse.json({
      results: results.results,
      fastest_lap_driver_id: results.fastest_lap_driver_id,
      prediction: prediction ? {
        p1: prediction.p1,
        p2: prediction.p2,
        p3: prediction.p3,
        fastest_lap: prediction.fastest_lap,
      } : null,
      score: score ? {
        perfect_match: score.perfect_match,
        podium_lock: score.podium_lock,
        almost: score.almost,
        fastest_lap: score.fastest_lap,
        total: score.total,
      } : null,
    });
  } catch (error) {
    console.error('F1 reveal error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to reveal results';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
