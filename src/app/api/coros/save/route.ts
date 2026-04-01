import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { save_coros_data } from '@/lib/db'

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request })
  if (!token) {
    const pin = request.headers.get('X-Guest-Pin')
    const valid_pins = (process.env.GUEST_PINS || '').split(',').map(p => p.trim()).filter(Boolean)
    if (!pin || !valid_pins.includes(pin)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
  }

  const body = await request.json()
  const { date, data } = body

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid or missing date (YYYY-MM-DD)' }, { status: 400 })
  }
  if (!data || typeof data !== 'object') {
    return NextResponse.json({ error: 'Invalid or missing data object' }, { status: 400 })
  }

  await save_coros_data(date, JSON.stringify(data))
  return NextResponse.json({ ok: true, date })
}
