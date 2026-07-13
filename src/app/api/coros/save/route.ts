import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { save_coros_data } from '@/lib/db'

// CORS headers for cross-origin requests
const ALLOWED_ORIGINS = ['https://8i11.vercel.app', 'http://localhost:3000', 'https://t.coros.com']

function cors_headers(origin?: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Guest-Pin',
  }
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: cors_headers(request.headers.get('origin')) })
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request })
  if (!token) {
    const pin = request.headers.get('X-Guest-Pin')
    const valid_pins = (process.env.GUEST_PINS || process.env.GUEST_PIN || '').split(',').map(p => p.trim()).filter(Boolean)
    if (!pin || !valid_pins.includes(pin)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401, headers: cors_headers(request.headers.get('origin')) })
    }
  }

  const body = await request.json()
  const { date, data } = body

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid or missing date (YYYY-MM-DD)' }, { status: 400, headers: cors_headers(request.headers.get('origin')) })
  }
  if (!data || typeof data !== 'object') {
    return NextResponse.json({ error: 'Invalid or missing data object' }, { status: 400, headers: cors_headers(request.headers.get('origin')) })
  }

  await save_coros_data(date, JSON.stringify(data))
  return NextResponse.json({ ok: true, date }, { headers: cors_headers(request.headers.get('origin')) })
}
