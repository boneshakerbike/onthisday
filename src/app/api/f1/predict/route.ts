import { NextRequest, NextResponse } from 'next/server';
import { save_prediction, get_prediction, get_roster, update_prediction } from '@/lib/f1/db';
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

    // Roster check: if roster exists, only rostered players can predict
    const roster = await get_roster(season);
    if (roster.length > 0 && !roster.includes(player_name)) {
      return NextResponse.json(
        { error: 'You are not on the roster for this season' },
        { status: 403 }
      );
    }

    // If prediction exists and is locked, reject edit
    const existing = await get_prediction(season, round, st, player_name);
    if (existing) {
      if (existing.is_locked) {
        return NextResponse.json(
          { error: 'Prediction is locked' },
          { status: 409 }
        );
      }
      // Overwrite existing prediction (picks only, does not affect lock state)
      await update_prediction(season, round, st, player_name, p1, p2, p3, fastest_lap || null);
      return NextResponse.json({ prediction_id: existing.id, saved: true });
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

    // NOTE: Do NOT set player state here — lock route handles the transition to 'watching'
    return NextResponse.json({ prediction_id, saved: true });
  } catch (error) {
    console.error('F1 predict error:', error);
    return NextResponse.json(
      { error: 'Failed to save prediction' },
      { status: 500 }
    );
  }
}
