import { NextRequest, NextResponse } from 'next/server';
import {
  get_player_round_states, get_prediction, get_score,
  get_cached_schedule, get_roster, get_predictions_for_session,
  get_all_player_states_for_round,
} from '@/lib/f1/db';
import { STANDARD_WEEKEND, SPRINT_WEEKEND } from '@/lib/f1/types';
import type { SessionType } from '@/lib/f1/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const season = parseInt(searchParams.get('season') || '0', 10);
  const round = parseInt(searchParams.get('round') || '0', 10);
  const player_name = searchParams.get('player') || '';

  if (!season || !round || !player_name) {
    return NextResponse.json(
      { error: 'Missing required params: season, round, player' },
      { status: 400 }
    );
  }

  try {
    // Determine session order based on sprint weekend
    const schedule = await get_cached_schedule(season);
    const race = schedule?.find(r => r.round === round);
    const session_order: SessionType[] = race?.is_sprint_weekend
      ? SPRINT_WEEKEND
      : STANDARD_WEEKEND;

    const roster = await get_roster(season);
    const has_roster = roster.length > 0;

    const states = await get_player_round_states(season, round, player_name);
    const state_map = new Map(states.map(s => [s.session_type, s.state]));

    // Get all player states for group info
    const all_states = has_roster
      ? await get_all_player_states_for_round(season, round)
      : [];

    // Build session info with step-lock logic
    let previous_revealed = true; // first session is always unlocked

    const sessions = [];
    for (const st of session_order) {
      const state = state_map.get(st) || 'predicting';
      const locked = !previous_revealed;

      const prediction = await get_prediction(season, round, st, player_name);
      let score = null;
      if (prediction) {
        const s = await get_score(prediction.id);
        if (s) score = { perfect_match: s.perfect_match, podium_lock: s.podium_lock, almost: s.almost, fastest_lap: s.fastest_lap, total: s.total };
      }

      // Group state: who has predicted, who is missing
      let group = null;
      if (has_roster) {
        const session_predictions = await get_predictions_for_session(season, round, st);
        const predicted_players = new Set(session_predictions.map(p => p.player_name));
        const missing = roster.filter(p => !predicted_players.has(p));
        const all_predicted = missing.length === 0;

        group = {
          all_predicted,
          missing,
          predictions: all_predicted
            ? session_predictions.map(p => ({
                player_name: p.player_name,
                p1: p.p1, p2: p.p2, p3: p.p3,
                fastest_lap: p.fastest_lap,
              }))
            : null,
        };
      }

      sessions.push({
        session_type: st,
        state: locked ? 'locked' : state,
        prediction: prediction ? { p1: prediction.p1, p2: prediction.p2, p3: prediction.p3, fastest_lap: prediction.fastest_lap } : null,
        score,
        group,
      });

      previous_revealed = state === 'revealed';
    }

    return NextResponse.json({ season, round, player_name, roster, sessions });
  } catch (error) {
    console.error('F1 state error:', error);
    return NextResponse.json(
      { error: 'Failed to get player state' },
      { status: 500 }
    );
  }
}
