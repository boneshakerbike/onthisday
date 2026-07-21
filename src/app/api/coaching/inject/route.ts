/**
 * API route: POST /api/coaching/inject
 * Builds the data injection string from Oura + Ride with GPS + manual inputs.
 * No COROS. Called by /coach page before starting a chat session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { build_data_injection, ManualInputs } from '@/lib/coaching/data-injection';
import type { RwgpsActivity } from '@/lib/ridewithgps';

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request });
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { date_str, epoch_day, manual, oura_live, activities } = body as {
      date_str: string;
      epoch_day: number;
      manual: ManualInputs;
      oura_live?: Record<string, unknown>;
      activities?: RwgpsActivity[];
    };

    if (!date_str || !epoch_day) {
      return NextResponse.json({ error: 'date_str and epoch_day are required' }, { status: 400 });
    }

    const { injection, metrics } = await build_data_injection(
      date_str, epoch_day, manual || {}, oura_live, activities
    );

    return NextResponse.json({ injection, metrics });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Injection build failed' },
      { status: 500 }
    );
  }
}
