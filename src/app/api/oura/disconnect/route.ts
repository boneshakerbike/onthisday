/**
 * API route: DELETE /api/oura/disconnect
 * Removes stored Oura tokens (disconnects account)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { delete_oura_tokens } from '@/lib/db';

export async function DELETE(request: NextRequest) {
  const token = await getToken({ req: request });
  const pin_header = request.headers.get('X-Guest-Pin');
  const valid_pins = (process.env.GUEST_PINS || process.env.GUEST_PIN || '')
    .split(',').map(p => p.trim()).filter(Boolean);

  if (!token && (!pin_header || !valid_pins.includes(pin_header))) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    await delete_oura_tokens();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Oura disconnect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
