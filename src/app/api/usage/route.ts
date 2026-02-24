/**
 * API route: GET /api/usage
 * Admin-only dashboard for Anthropic API usage tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { auth_options } from '@/lib/auth';
import { get_usage_logs, get_usage_summary, get_pricing_config } from '@/lib/db';

async function require_admin(): Promise<boolean> {
  const session = await getServerSession(auth_options);
  if (!session?.user || (session.user as { id?: string }).id === 'guest') {
    return false;
  }
  return true;
}

export async function GET(request: NextRequest) {
  if (!await require_admin()) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'summary';

    if (view === 'pricing') {
      const pricing = await get_pricing_config();
      return NextResponse.json({ success: true, pricing });
    }

    if (view === 'logs') {
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const offset = parseInt(searchParams.get('offset') || '0', 10);
      const status = searchParams.get('status') || undefined;
      const model = searchParams.get('model') || undefined;

      const logs = await get_usage_logs({ status, model, limit, offset });
      return NextResponse.json({ success: true, logs });
    }

    // Default: summary view
    // Rolling 24h window
    const now = new Date();
    const h24_ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Calendar month (Mountain Time boundaries)
    const mst_now = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
    const month_start = new Date(mst_now.getFullYear(), mst_now.getMonth(), 1);
    const month_end = new Date(mst_now.getFullYear(), mst_now.getMonth() + 1, 1);

    const [rolling_24h, calendar_month, pricing] = await Promise.all([
      get_usage_summary({
        start: h24_ago.toISOString(),
        end: now.toISOString(),
      }),
      get_usage_summary({
        start: month_start.toISOString(),
        end: month_end.toISOString(),
      }),
      get_pricing_config(),
    ]);

    return NextResponse.json({
      success: true,
      rolling_24h,
      calendar_month,
      pricing,
      generated_at: now.toISOString(),
    });

  } catch (error) {
    console.error('Usage API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}
