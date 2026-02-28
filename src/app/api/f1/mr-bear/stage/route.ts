/**
 * Mr Bear staged picks API
 * POST — stage picks for auto-insert (guest PIN required)
 * GET  — list staged picks (guest PIN required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { save_staged_picks, get_all_staged_picks } from '@/lib/f1/db';
import type { SessionType } from '@/lib/f1/types';

function check_pin(request: NextRequest): boolean {
  const pin = request.headers.get('X-Guest-Pin');
  if (!pin) return false;
  const valid = (process.env.GUEST_PINS || process.env.GUEST_PIN || '')
    .split(',').map(p => p.trim()).filter(Boolean);
  return valid.includes(pin);
}

export async function POST(request: NextRequest) {
  try {
    if (!check_pin(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { season, round, session_type, p1, p2, p3, fastest_lap } = body;

    if (!season || !round || !session_type || !p1 || !p2 || !p3) {
      return NextResponse.json(
        { error: 'Missing required fields: season, round, session_type, p1, p2, p3' },
        { status: 400 }
      );
    }

    await save_staged_picks(season, round, session_type as SessionType, p1, p2, p3, fastest_lap || null);
    return NextResponse.json({ staged: true, season, round, session_type });
  } catch (error) {
    console.error('Mr Bear stage error:', error);
    return NextResponse.json({ error: 'Failed to stage picks' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!check_pin(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const season = parseInt(url.searchParams.get('season') || String(new Date().getFullYear()));
    const round_param = url.searchParams.get('round');
    const round = round_param ? parseInt(round_param) : undefined;

    const picks = await get_all_staged_picks(season, round);
    return NextResponse.json(picks);
  } catch (error) {
    console.error('Mr Bear stage GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch staged picks' }, { status: 500 });
  }
}
