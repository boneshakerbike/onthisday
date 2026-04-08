/**
 * API route: /api/text-notes
 * CRUD for saved "What Am I Trying To Say" notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { save_text_note, get_text_notes, delete_text_note } from '@/lib/db';

async function require_auth(request: NextRequest): Promise<NextResponse | null> {
  const token = await getToken({ req: request });
  if (token) return null;

  const pin_header = request.headers.get('X-Guest-Pin');
  if (pin_header) {
    const valid_pins = (process.env.GUEST_PINS || process.env.GUEST_PIN || '')
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);
    if (valid_pins.includes(pin_header)) return null;
  }

  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const auth_error = await require_auth(request);
  if (auth_error) return auth_error;

  try {
    const notes = await get_text_notes();
    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Failed to fetch text notes:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth_error = await require_auth(request);
  if (auth_error) return auth_error;

  try {
    const { content } = await request.json();

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (content.length > 20000) {
      return NextResponse.json({ error: 'Content too long (max 20,000 characters)' }, { status: 400 });
    }

    const id = await save_text_note(content.trim());
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Failed to save text note:', error);
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth_error = await require_auth(request);
  if (auth_error) return auth_error;

  try {
    const { id } = await request.json();

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
    }

    const deleted = await delete_text_note(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete text note:', error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
