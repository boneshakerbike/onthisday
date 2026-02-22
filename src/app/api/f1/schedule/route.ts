import { NextRequest, NextResponse } from 'next/server';
import { get_schedule } from '@/lib/f1/cache';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const season = parseInt(searchParams.get('season') || String(new Date().getFullYear()), 10);

  try {
    const races = await get_schedule(season);
    return NextResponse.json({ season, races });
  } catch (error) {
    console.error('F1 schedule error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule' },
      { status: 500 }
    );
  }
}
