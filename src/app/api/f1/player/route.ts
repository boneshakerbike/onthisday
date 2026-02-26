/**
 * F1 Player Identity API
 * GET  ?id=<player_id>  — return stored display_name or 404
 * POST { player_id, display_name } — upsert
 */

import { NextRequest, NextResponse } from 'next/server';
import { get_player_display_name, upsert_player_name } from '@/lib/f1/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const player_id = searchParams.get('id')?.trim();

  if (!player_id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const display_name = await get_player_display_name(player_id);
  if (!display_name) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ display_name });
}

export async function POST(request: NextRequest) {
  try {
    const { player_id, display_name } = await request.json();

    if (!player_id?.trim() || !display_name?.trim()) {
      return NextResponse.json({ error: 'Missing player_id or display_name' }, { status: 400 });
    }

    const name = (display_name as string).trim().slice(0, 50);
    await upsert_player_name(player_id.trim(), name);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Player upsert error:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
