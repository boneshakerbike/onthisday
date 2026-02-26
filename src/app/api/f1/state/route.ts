import { NextRequest, NextResponse } from 'next/server';
import {
  get_player_round_states, get_prediction, get_score,
  get_cached_schedule, get_roster, get_predictions_for_session,
  get_all_player_states_for_round, set_player_state,
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
    const schedule = await get_cached_schedule(season);
    const race = schedule?.find(r => r.round === round);
    const session_order: SessionType[] = race?.is_sprint_weekend
      ? SPRINT_WEEKEND
      : STANDARD_WEEKEND;

    const roster = await get_roster(season);
    const has_roster = roster.length > 0;

    // f1_player_state used only to detect 'revealed' (player explicitly triggered reveal)
    const states = await get_player_round_states(season, round, player_name);
    const state_map = new Map(states.map(s => [s.session_type, s.state]));

    const all_states = has_roster
      ? await get_all_player_states_for_round(season, round)
      : [];
    void all_states;

    let previous_revealed = true;

    const sessions = [];
    for (const st of session_order) {
      const step_locked = !previous_revealed;

      const prediction = await get_prediction(season, round, st, player_name);

      // Fetch score once — used for both state derivation and response
      let score_obj = null;
      if (prediction) {
        score_obj = await get_score(prediction.id);
      }

      // Derive effective state from prediction data.
      // Auto-transition to 'revealed' if another player's reveal already scored this prediction.
      let effective_state: string;
      if (!prediction || !prediction.is_locked) {
        effective_state = 'predicting';
      } else {
        const db_state = state_map.get(st);
        if (db_state === 'revealed') {
          effective_state = 'revealed';
        } else if (score_obj) {
          // Score exists (computed when another player revealed) — auto-transition
          await set_player_state(season, round, st, player_name, 'revealed');
          effective_state = 'revealed';
        } else {
          effective_state = 'watching';
        }
      }

      const score = score_obj
        ? { perfect_match: score_obj.perfect_match, podium_lock: score_obj.podium_lock, almost: score_obj.almost, fastest_lap: score_obj.fastest_lap, total: score_obj.total }
        : null;

      // Group state: show ALL saved picks (not just locked) so players can see each other's choices
      let group = null;
      if (has_roster) {
        const session_predictions = await get_predictions_for_session(season, round, st);
        const locked_players = new Set(session_predictions.filter(p => p.is_locked).map(p => p.player_name));
        const saved_players = new Set(session_predictions.map(p => p.player_name));
        const missing_lock = roster.filter(p => !locked_players.has(p));
        const missing_save = roster.filter(p => !saved_players.has(p));
        const all_locked = missing_lock.length === 0;
        const all_saved = missing_save.length === 0;

        group = {
          all_predicted: all_locked,
          missing: missing_lock,
          all_saved,
          missing_save,
          predictions: session_predictions.length > 0
            ? await Promise.all(session_predictions.map(async p => {
                const p_score = effective_state === 'revealed' ? await get_score(p.id) : null;
                return {
                  player_name: p.player_name,
                  p1: p.p1, p2: p.p2, p3: p.p3,
                  fastest_lap: p.fastest_lap,
                  is_locked: p.is_locked,
                  score: p_score ? { perfect_match: p_score.perfect_match, podium_lock: p_score.podium_lock, almost: p_score.almost, fastest_lap: p_score.fastest_lap, total: p_score.total } : null,
                };
              }))
            : null,
        };
      }

      sessions.push({
        session_type: st,
        state: step_locked ? 'locked' : effective_state,
        prediction: prediction ? {
          p1: prediction.p1, p2: prediction.p2, p3: prediction.p3,
          fastest_lap: prediction.fastest_lap,
          is_locked: !!prediction.is_locked,
        } : null,
        score,
        group,
      });

      previous_revealed = effective_state === 'revealed';
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
