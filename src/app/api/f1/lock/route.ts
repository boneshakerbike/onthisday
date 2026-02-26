import { NextRequest, NextResponse } from 'next/server';
import { get_prediction, lock_prediction, set_player_state } from '@/lib/f1/db';
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

    const prediction = await get_prediction(season, round, st, player_name);
    if (!prediction) {
      return NextResponse.json(
        { error: 'No prediction to lock — save your picks first' },
        { status: 400 }
      );
    }

    // Idempotent: already locked is fine
    if (prediction.is_locked) {
      return NextResponse.json({ locked: true });
    }

    await lock_prediction(season, round, st, player_name);
    await set_player_state(season, round, st, player_name, 'watching');

    return NextResponse.json({ locked: true, state: 'watching' });
  } catch (error) {
    console.error('F1 lock error:', error);
    return NextResponse.json(
      { error: 'Failed to lock prediction' },
      { status: 500 }
    );
  }
}
