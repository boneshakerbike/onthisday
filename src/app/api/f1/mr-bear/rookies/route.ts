import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { auth_options } from '@/lib/auth';
import { get_mr_bear_rookies, set_mr_bear_rookies } from '@/lib/db';
import { get_driver_name_map } from '@/lib/f1/mr_bear';

async function require_admin(): Promise<boolean> {
  const session = await getServerSession(auth_options);
  return !!session?.user && (session.user as { id?: string }).id !== 'guest';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const season = parseInt(searchParams.get('season') || '0', 10);

  if (!season) {
    return NextResponse.json({ error: 'Missing season' }, { status: 400 });
  }

  try {
    // The saved rookie list must survive a driver-list failure, so the two reads
    // are independent: only a DB failure is a genuine 500 here.
    const rookies = await get_mr_bear_rookies(season);

    let driver_names: Record<string, string> = {};
    let driver_names_error: string | null = null;
    try {
      driver_names = await get_driver_name_map(season);
    } catch (error) {
      driver_names_error = error instanceof Error ? error.message : 'Unknown error';
      console.error('Mr Bear rookies: driver name map failed:', error);
    }

    return NextResponse.json({ season, rookies, driver_names, driver_names_error });
  } catch (error) {
    console.error('Mr Bear rookies GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch rookie list' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!await require_admin()) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const { season, driver_ids } = await request.json();

    if (!season || !Array.isArray(driver_ids) || !driver_ids.every((id: unknown) => typeof id === 'string')) {
      return NextResponse.json({ error: 'Missing season or invalid driver_ids' }, { status: 400 });
    }

    await set_mr_bear_rookies(season, driver_ids);
    const rookies = await get_mr_bear_rookies(season);
    return NextResponse.json({ season, rookies });
  } catch (error) {
    console.error('Mr Bear rookies POST error:', error);
    return NextResponse.json({ error: 'Failed to save rookie list' }, { status: 500 });
  }
}
