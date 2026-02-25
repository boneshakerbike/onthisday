import { NextRequest, NextResponse } from 'next/server';
import { save_prediction, get_prediction, set_player_state, get_roster, update_prediction, get_predictions_for_session } from '@/lib/f1/db';
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

    // Check for existing prediction — allow edit if group isn't fully locked in
    const existing = await get_prediction(season, round, st, player_name);
    if (existing) {
      if (roster.length > 0) {
        const all_predictions = await get_predictions_for_session(season, round, st);
        const predicted_players = new Set(all_predictions.map(p => p.player_name));
        const all_predicted = roster.every(p => predicted_players.has(p));
        if (all_predicted) {
          return NextResponse.json(
            { error: 'All players have locked in — predictions cannot be changed' },
            { status: 409 }
          );
        }
      }
      // Overwrite existing prediction
      await update_prediction(season, round, st, player_name, p1, p2, p3, fastest_lap || null);
      return NextResponse.json({ prediction_id: existing.id, state: 'watching' });
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
