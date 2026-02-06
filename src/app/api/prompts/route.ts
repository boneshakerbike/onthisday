/**
 * API route: /api/prompts
 * CRUD for prompt library
 * GET - List all prompts, or single prompt with versions (?id=xxx)
 * POST - Create new prompt
 * PATCH - Save version, rename, or trim
 * DELETE - Remove prompt and all versions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  get_all_prompts, get_prompt, create_prompt,
  save_prompt_version, get_prompt_versions,
  rename_prompt, delete_prompt, trim_prompt_versions
} from '@/lib/db';

function cors_headers() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Guest-Pin',
  };
}

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

export async function OPTIONS() {
  return NextResponse.json({}, { headers: cors_headers() });
}

export async function GET(request: NextRequest) {
  const auth_error = await require_auth(request);
  if (auth_error) return auth_error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const prompt = await get_prompt(id);
      if (!prompt) {
        return NextResponse.json({ error: 'Prompt not found' }, { status: 404, headers: cors_headers() });
      }
      const versions = await get_prompt_versions(id);
      return NextResponse.json({ success: true, prompt, versions }, { headers: cors_headers() });
    }

    const prompts = await get_all_prompts();
    return NextResponse.json({ success: true, prompts }, { headers: cors_headers() });
  } catch (error) {
    console.error('GET prompts error:', error);
    return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500, headers: cors_headers() });
  }
}

export async function POST(request: NextRequest) {
  const auth_error = await require_auth(request);
  if (auth_error) return auth_error;

  try {
    const { name, content } = await request.json();

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const prompt_content = (typeof content === 'string') ? content : '';

    const id = await create_prompt(name.trim(), prompt_content);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('POST prompts error:', error);
    return NextResponse.json({ error: 'Failed to create prompt' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth_error = await require_auth(request);
  if (auth_error) return auth_error;

  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json({ error: 'Prompt ID is required' }, { status: 400 });
    }

    if (action === 'save') {
      const { content, note } = body;
      if (!content || typeof content !== 'string') {
        return NextResponse.json({ error: 'Content is required' }, { status: 400 });
      }
      const version_number = await save_prompt_version(id, content, note);
      return NextResponse.json({ success: true, version_number });
    }

    if (action === 'rename') {
      const { name } = body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
      }
      const updated = await rename_prompt(id, name.trim());
      if (!updated) return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    if (action === 'trim') {
      const keep_count = body.keep_count || 5;
      const deleted = await trim_prompt_versions(id, keep_count);
      return NextResponse.json({ success: true, deleted });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('PATCH prompts error:', error);
    return NextResponse.json({ error: 'Failed to update prompt' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth_error = await require_auth(request);
  if (auth_error) return auth_error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Prompt ID is required' }, { status: 400 });
    }

    const deleted = await delete_prompt(id);
    if (!deleted) return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE prompts error:', error);
    return NextResponse.json({ error: 'Failed to delete prompt' }, { status: 500 });
  }
}
