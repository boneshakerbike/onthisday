import { NextRequest, NextResponse } from 'next/server';
import { get_drivers } from '@/lib/f1/cache';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const season = parseInt(searchParams.get('season') || String(new Date().getFullYear()), 10);

  try {
    const drivers = await get_drivers(season);
    return NextResponse.json({ season, drivers });
  } catch (error) {
    console.error('F1 drivers error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drivers' },
      { status: 500 }
    );
  }
}
