import { NextRequest, NextResponse } from 'next/server';
import { reveal_session } from '@/lib/f1/cache';
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
    const { results, prediction, score } = await reveal_session(season, round, st, player_name);

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
