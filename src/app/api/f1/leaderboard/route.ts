import { NextRequest, NextResponse } from 'next/server';
import { get_leaderboard } from '@/lib/f1/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const season = parseInt(searchParams.get('season') || String(new Date().getFullYear()), 10);

  try {
    const standings = await get_leaderboard(season);
    return NextResponse.json({ season, standings });
  } catch (error) {
    console.error('F1 leaderboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
