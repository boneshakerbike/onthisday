import { NextRequest, NextResponse } from 'next/server';
import {
  save_prediction, get_prediction, get_roster, update_prediction,
  lock_prediction, set_player_state, get_staged_picks, delete_staged_picks,
} from '@/lib/f1/db';
import type { SessionType } from '@/lib/f1/types';

const MR_BEAR = 'Mr Bear';

async function try_auto_insert_mr_bear(
  season: number, round: number, session_type: SessionType, roster: string[]
): Promise<void> {
  if (!roster.includes(MR_BEAR)) return;

  const existing = await get_prediction(season, round, session_type, MR_BEAR);
  if (existing) return;

  const staged = await get_staged_picks(season, round, session_type);
  if (!staged) return;

  await save_prediction(season, round, session_type, MR_BEAR, staged.p1, staged.p2, staged.p3, staged.fastest_lap);
  await lock_prediction(season, round, session_type, MR_BEAR);
  await set_player_state(season, round, session_type, MR_BEAR, 'watching');
  await delete_staged_picks(season, round, session_type);
}

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

    // Roster check: season must have a roster before accepting predictions
    const roster = await get_roster(season);
    if (roster.length === 0) {
      return NextResponse.json(
        { error: 'No roster set up for this season' },
        { status: 400 }
      );
    }
    if (!roster.includes(player_name)) {
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
      if (player_name !== MR_BEAR) {
        try { await try_auto_insert_mr_bear(season, round, st, roster); } catch (e) { console.error('Mr Bear auto-insert error:', e); }
      }
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
    if (player_name !== MR_BEAR) {
      try { await try_auto_insert_mr_bear(season, round, st, roster); } catch (e) { console.error('Mr Bear auto-insert error:', e); }
    }
    return NextResponse.json({ prediction_id, saved: true });
  } catch (error) {
    console.error('F1 predict error:', error);
    return NextResponse.json(
      { error: 'Failed to save prediction' },
      { status: 500 }
    );
  }
}
