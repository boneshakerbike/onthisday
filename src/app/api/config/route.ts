/**
 * API route: GET /api/config
 * Returns configuration status (e.g., whether API key is set)
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    has_api_key: !!process.env.ANTHROPIC_API_KEY
  });
}
