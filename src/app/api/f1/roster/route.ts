import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { auth_options } from '@/lib/auth';
import { get_roster, add_to_roster, remove_from_roster } from '@/lib/f1/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const season = parseInt(searchParams.get('season') || '0', 10);

  if (!season) {
    return NextResponse.json({ error: 'Missing season' }, { status: 400 });
  }

  const roster = await get_roster(season);
  return NextResponse.json({ season, roster });
}

async function require_admin() {
  const session = await getServerSession(auth_options);
  if (!session?.user || (session.user as { id?: string }).id === 'guest') {
    return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  if (!await require_admin()) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const { season, player_name } = await request.json();
    if (!season || !player_name?.trim()) {
      return NextResponse.json({ error: 'Missing season or player_name' }, { status: 400 });
    }

    await add_to_roster(season, player_name.trim());
    const roster = await get_roster(season);
    return NextResponse.json({ season, roster });
  } catch (error) {
    console.error('Roster add error:', error);
    return NextResponse.json({ error: 'Failed to add player' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!await require_admin()) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const { season, player_name } = await request.json();
    if (!season || !player_name) {
      return NextResponse.json({ error: 'Missing season or player_name' }, { status: 400 });
    }

    await remove_from_roster(season, player_name);
    const roster = await get_roster(season);
    return NextResponse.json({ season, roster });
  } catch (error) {
    console.error('Roster remove error:', error);
    return NextResponse.json({ error: 'Failed to remove player' }, { status: 500 });
  }
}
