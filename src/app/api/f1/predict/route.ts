import { NextRequest, NextResponse } from 'next/server';
import { save_prediction, get_prediction, set_player_state } from '@/lib/f1/db';
import type { SessionType } from '@/lib/f1/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season, round, session_type, player_name, p1, p2, p3, fastest_lap } = body;

    if (!season || !round || !session_type || !player_name || !p1 || !p2 || !p3) {
      return NextResponse.json(
        { error: 'Missing required fields: season, round, session_type, player_name, p1, p2, p3' },
        { status: 400 }
      );
    }

    const st = session_type as SessionType;

    // Check for duplicate prediction
    const existing = await get_prediction(season, round, st, player_name);
    if (existing) {
      return NextResponse.json(
        { error: 'Prediction already submitted for this session' },
        { status: 409 }
      );
    }

    // Check no duplicate drivers
    const picks = [p1, p2, p3];
    if (new Set(picks).size !== 3) {
      return NextResponse.json(
        { error: 'Cannot pick the same driver twice' },
        { status: 400 }
      );
    }

    const prediction_id = await save_prediction(
      season, round, st, player_name, p1, p2, p3, fastest_lap || null
    );

    // Move player to watching state
    await set_player_state(season, round, st, player_name, 'watching');

    return NextResponse.json({ prediction_id, state: 'watching' });
  } catch (error) {
    console.error('F1 predict error:', error);
    return NextResponse.json(
      { error: 'Failed to save prediction' },
      { status: 500 }
    );
  }
}
