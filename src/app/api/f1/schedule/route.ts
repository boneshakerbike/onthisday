import { NextRequest, NextResponse } from 'next/server';
import { get_schedule } from '@/lib/f1/cache';
import { get_cancelled_rounds } from '@/lib/f1/db';
import type { F1CancelledRound } from '@/lib/f1/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const season = parseInt(searchParams.get('season') || String(new Date().getFullYear()), 10);

  try {
    const [races, cancelled_rows] = await Promise.all([
      get_schedule(season),
      get_cancelled_rounds(season),
    ]);

    const active_circuits = new Set(races.map(r => r.circuit_id));
    const cancelled_by_circuit = new Map<string, F1CancelledRound>();
    for (const row of cancelled_rows) {
      if (row.source === 'auto' && active_circuits.has(row.circuit_id)) {
        continue;
      }
      const existing = cancelled_by_circuit.get(row.circuit_id);
      if (!existing || (existing.source === 'auto' && row.source === 'admin')) {
        cancelled_by_circuit.set(row.circuit_id, row);
      }
    }

    return NextResponse.json({
      season,
      races,
      cancelled_rounds: Array.from(cancelled_by_circuit.values()),
    });
  } catch (error) {
    console.error('F1 schedule error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule' },
      { status: 500 }
    );
  }
}
