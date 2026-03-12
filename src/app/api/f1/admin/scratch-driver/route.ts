import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { auth_options } from '@/lib/auth';
import {
  get_all_scratched_for_round,
  upsert_scratched_driver,
  delete_scratched_driver,
} from '@/lib/f1/db';

async function require_admin(): Promise<boolean> {
  const session = await getServerSession(auth_options);
  return !!session?.user && (session.user as { id?: string }).id !== 'guest';
}

export async function GET(request: NextRequest) {
  if (!await require_admin()) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const season = parseInt(searchParams.get('season') || '');
  const round = parseInt(searchParams.get('round') || '');

  if (!season || !round) {
    return NextResponse.json({ error: 'Missing season or round' }, { status: 400 });
  }

  const scratched = await get_all_scratched_for_round(season, round);
  return NextResponse.json({ season, round, scratched });
}

export async function POST(request: NextRequest) {
  if (!await require_admin()) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const { season, round, driver_id } = await request.json();
    if (!season || !round || !driver_id) {
      return NextResponse.json({ error: 'Missing season, round, or driver_id' }, { status: 400 });
    }

    await upsert_scratched_driver(season, round, driver_id);

    const scratched = await get_all_scratched_for_round(season, round);
    return NextResponse.json({
      season, round, scratched,
      message: `Scratched ${driver_id} for round ${round}. Re-poke Mr Bear.`,
    });
  } catch (error) {
    console.error('Scratch driver POST error:', error);
    return NextResponse.json({ error: 'Failed to scratch driver' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!await require_admin()) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const { season, round, driver_id } = await request.json();
    if (!season || !round || !driver_id) {
      return NextResponse.json({ error: 'Missing season, round, or driver_id' }, { status: 400 });
    }

    await delete_scratched_driver(season, round, driver_id);

    const scratched = await get_all_scratched_for_round(season, round);
    return NextResponse.json({ season, round, scratched });
  } catch (error) {
    console.error('Scratch driver DELETE error:', error);
    return NextResponse.json({ error: 'Failed to unscratch driver' }, { status: 500 });
  }
}
