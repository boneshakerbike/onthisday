import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { get_coros_data, get_coros_range } from '@/lib/db'

// CORS headers for cross-origin requests
const ALLOWED_ORIGINS = ['https://8i11.vercel.app', 'http://localhost:3000', 'https://t.coros.com']

function cors_headers(origin?: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Guest-Pin',
  }
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: cors_headers(request.headers.get('origin')) })
}

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request })
  if (!token) {
    const pin = request.headers.get('X-Guest-Pin')
    const valid_pins = (process.env.GUEST_PINS || process.env.GUEST_PIN || '').split(',').map(p => p.trim()).filter(Boolean)
    if (!pin || !valid_pins.includes(pin)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401, headers: cors_headers(request.headers.get('origin')) })
    }
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (start && end) {
    const rows = await get_coros_range(start, end)
    return NextResponse.json(rows, { headers: cors_headers(request.headers.get('origin')) })
  }

  if (date) {
    const row = await get_coros_data(date)
    if (!row) return NextResponse.json({ error: 'No data for this date' }, { status: 404, headers: cors_headers(request.headers.get('origin')) })
    return NextResponse.json(row, { headers: cors_headers(request.headers.get('origin')) })
  }

  return NextResponse.json({ error: 'Provide ?date= or ?start=&end=' }, { status: 400, headers: cors_headers(request.headers.get('origin')) })
}
