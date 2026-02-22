import { NextRequest, NextResponse } from 'next/server';
import { get_results_if_cached } from '@/lib/f1/cache';
import type { SessionType } from '@/lib/f1/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const season = parseInt(searchParams.get('season') || '0', 10);
  const round = parseInt(searchParams.get('round') || '0', 10);
  const session_type = searchParams.get('session_type') as SessionType;

  if (!season || !round || !session_type) {
    return NextResponse.json(
      { error: 'Missing required params: season, round, session_type' },
      { status: 400 }
    );
  }

  try {
    const results = await get_results_if_cached(season, round, session_type);

    if (!results) {
      return NextResponse.json(
        { error: 'Results not yet revealed for this session' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      results: results.results,
      fastest_lap_driver_id: results.fastest_lap_driver_id,
    });
  } catch (error) {
    console.error('F1 results error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch results' },
      { status: 500 }
    );
  }
}
