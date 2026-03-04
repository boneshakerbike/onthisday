import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { auth_options } from '@/lib/auth';
import { get_schedule, refresh_schedule } from '@/lib/f1/cache';
import {
  get_cancelled_rounds,
  upsert_cancelled_round,
  delete_admin_cancelled_round,
} from '@/lib/f1/db';

async function require_admin(): Promise<boolean> {
  const session = await getServerSession(auth_options);
  return !!session?.user && (session.user as { id?: string }).id !== 'guest';
}

export async function POST(request: NextRequest) {
  if (!await require_admin()) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const { season, round } = await request.json();
    if (!season || !round) {
      return NextResponse.json({ error: 'Missing season or round' }, { status: 400 });
    }

    const schedule = await get_schedule(season);
    const race = schedule.find(r => r.round === round);
    if (!race) {
      return NextResponse.json({ error: `Round ${round} not found in current schedule` }, { status: 404 });
    }

    await upsert_cancelled_round(
      season,
      race.round,
      race.race_name,
      race.circuit_id,
      'admin'
    );
    await refresh_schedule(season);

    const cancelled_rounds = await get_cancelled_rounds(season);
    return NextResponse.json({ season, cancelled_rounds });
  } catch (error) {
    console.error('F1 admin cancel-round POST error:', error);
    return NextResponse.json({ error: 'Failed to cancel round' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!await require_admin()) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const { season, round, circuit_id } = await request.json();
    if (!season || (!round && !circuit_id)) {
      return NextResponse.json(
        { error: 'Missing season and round or circuit_id' },
        { status: 400 }
      );
    }

    let target_circuit_id = circuit_id as string | undefined;
    if (!target_circuit_id) {
      const admin_cancelled = await get_cancelled_rounds(season, 'admin');
      target_circuit_id = admin_cancelled.find(r => r.round === round)?.circuit_id;
    }

    if (!target_circuit_id) {
      return NextResponse.json({ error: 'Cancelled round not found' }, { status: 404 });
    }

    await delete_admin_cancelled_round(season, target_circuit_id);
    await refresh_schedule(season);

    const cancelled_rounds = await get_cancelled_rounds(season);
    return NextResponse.json({ season, cancelled_rounds });
  } catch (error) {
    console.error('F1 admin cancel-round DELETE error:', error);
    return NextResponse.json({ error: 'Failed to un-cancel round' }, { status: 500 });
  }
}
