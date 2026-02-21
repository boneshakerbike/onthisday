/**
 * API route: /api/worklog
 * Agent session worklog - the drift-prevention system
 *
 * GET  - Read recent worklog entries (optional ?limit=N&agent_id=X) - PUBLIC
 * POST - Write a worklog entry on session end - REQUIRES API KEY
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  create_worklog_entry,
  get_worklog_entries,
  WorklogEntry
} from '@/lib/db';

const ALLOWED_ORIGINS = ['https://8i11.vercel.app', 'http://localhost:3000'];

function cors_headers(origin?: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Worklog-Key',
  };
}

function require_worklog_key(request: NextRequest): NextResponse | null {
  const key = request.headers.get('X-Worklog-Key');
  const valid_key = process.env.WORKLOG_API_KEY || '';

  if (!valid_key) {
    return NextResponse.json(
      { error: 'Worklog API key not configured on server' },
      { status: 503, headers: cors_headers() }
    );
  }

  if (key === valid_key) {
    return null;
  }

  return NextResponse.json(
    { error: 'Authentication required (X-Worklog-Key)' },
    { status: 401, headers: cors_headers() }
  );
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: cors_headers(request.headers.get('origin')) });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '3', 10) || 3, 50);
    const agent_id = searchParams.get('agent_id') || undefined;

    const entries = await get_worklog_entries(limit, agent_id);

    return NextResponse.json({
      success: true,
      entries,
      count: entries.length
    }, { headers: cors_headers(request.headers.get('origin')) });
  } catch (error) {
    console.error('GET worklog error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch worklog entries' },
      { status: 500, headers: cors_headers() }
    );
  }
}

export async function POST(request: NextRequest) {
  // Proxy to production when running locally
  if (!process.env.TURSO_DATABASE_URL) {
    const body = await request.text();
    const key = request.headers.get('X-Worklog-Key') || '';
    const res = await fetch('https://8i11.vercel.app/api/worklog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Worklog-Key': key,
      },
      body,
    });
    return NextResponse.json(await res.json(), { status: res.status });
  }

  const auth_error = require_worklog_key(request);
  if (auth_error) return auth_error;

  try {
    const body = await request.json();

    const { agent_id, machine_id, session_id, summary, tasks_touched, status, tags } = body;

    // Validate required fields
    if (!agent_id || typeof agent_id !== 'string') {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400, headers: cors_headers() });
    }
    if (!machine_id || typeof machine_id !== 'string') {
      return NextResponse.json({ error: 'machine_id is required' }, { status: 400, headers: cors_headers() });
    }
    const uuid_re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!session_id || typeof session_id !== 'string' || !uuid_re.test(session_id)) {
      return NextResponse.json({ error: 'session_id is required and must be a UUID' }, { status: 400, headers: cors_headers() });
    }
    if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
      return NextResponse.json({ error: 'summary is required' }, { status: 400, headers: cors_headers() });
    }
    if (summary.length > 10000) {
      return NextResponse.json({ error: 'summary must be under 10000 characters' }, { status: 413, headers: cors_headers() });
    }

    // Validate status enum
    const valid_statuses: WorklogEntry['status'][] = ['info', 'warning', 'blocked', 'done'];
    const entry_status = status || 'info';
    if (!valid_statuses.includes(entry_status)) {
      return NextResponse.json(
        { error: 'status must be one of: info, warning, blocked, done' },
        { status: 400, headers: cors_headers() }
      );
    }

    // Validate arrays
    const entry_tasks = Array.isArray(tasks_touched) ? tasks_touched.filter((t: unknown) => typeof t === 'string') : [];
    const entry_tags = Array.isArray(tags) ? tags.filter((t: unknown) => typeof t === 'string') : [];

    const id = await create_worklog_entry(
      agent_id.trim(),
      machine_id.trim(),
      session_id.trim(),
      summary.trim(),
      entry_tasks,
      entry_status,
      entry_tags
    );

    return NextResponse.json({
      success: true,
      id,
      message: 'Worklog entry created'
    }, { headers: cors_headers(request.headers.get('origin')) });
  } catch (error) {
    console.error('POST worklog error:', error);
    return NextResponse.json(
      { error: 'Failed to create worklog entry' },
      { status: 500, headers: cors_headers() }
    );
  }
}
