import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { get_coros_data, get_coros_range } from '@/lib/db'

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request })
  if (!token) {
    const pin = request.headers.get('X-Guest-Pin')
    const valid_pins = (process.env.GUEST_PINS || '').split(',').map(p => p.trim()).filter(Boolean)
    if (!pin || !valid_pins.includes(pin)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (start && end) {
    const rows = await get_coros_range(start, end)
    return NextResponse.json(rows)
  }

  if (date) {
    const row = await get_coros_data(date)
    if (!row) return NextResponse.json({ error: 'No data for this date' }, { status: 404 })
    return NextResponse.json(row)
  }

  return NextResponse.json({ error: 'Provide ?date= or ?start=&end=' }, { status: 400 })
}
