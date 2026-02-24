import { NextRequest, NextResponse } from 'next/server';
import { get_cached_schedule, get_cached_results, get_roster } from '@/lib/f1/db';
import { STANDARD_WEEKEND, SPRINT_WEEKEND } from '@/lib/f1/types';
import type { SessionType } from '@/lib/f1/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const season = parseInt(searchParams.get('season') || '0', 10);

  if (!season) {
    return NextResponse.json({ error: 'Missing season' }, { status: 400 });
  }

  try {
    const schedule = await get_cached_schedule(season);
    const roster = await get_roster(season);

    if (!schedule || schedule.length === 0) {
      return NextResponse.json({
        season,
        roster,
        active_round: 1,
        completed_rounds: [],
      });
    }

    const completed_rounds: number[] = [];
    let active_round = 1;

    for (const race of schedule) {
      const session_order: SessionType[] = race.is_sprint_weekend
        ? SPRINT_WEEKEND
        : STANDARD_WEEKEND;

      let all_revealed = true;
      for (const st of session_order) {
        const cached = await get_cached_results(race.season, race.round, st);
        if (!cached) {
          all_revealed = false;
          break;
        }
      }

      if (all_revealed) {
        completed_rounds.push(race.round);
      } else {
        active_round = race.round;
        break;
      }
    }

    // If all rounds completed, active_round is the last one
    if (completed_rounds.length === schedule.length) {
      active_round = schedule[schedule.length - 1].round;
    }

    return NextResponse.json({
      season,
      roster,
      active_round,
      completed_rounds,
    });
  } catch (error) {
    console.error('Season progress error:', error);
    return NextResponse.json({ error: 'Failed to get season progress' }, { status: 500 });
  }
}
