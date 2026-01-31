/**
 * API route: /api/suggestions
 * Manage feature suggestions and ideas
 *
 * GET - List suggestions (optional ?status=pending filter) - PUBLIC
 * POST - Create new suggestion - REQUIRES AUTH
 * PATCH - Update suggestion status - REQUIRES AUTH
 * DELETE - Remove suggestion - REQUIRES AUTH
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  get_suggestions,
  create_suggestion,
  update_suggestion,
  delete_suggestion,
  Suggestion
} from '@/lib/db';

async function require_auth(request: NextRequest): Promise<NextResponse | null> {
  const token = await getToken({ req: request });
  if (!token) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;

    const suggestions = await get_suggestions(status);

    return NextResponse.json({
      success: true,
      suggestions,
      count: suggestions.length
    });
  } catch (error) {
    console.error('GET suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth_error = await require_auth(request);
  if (auth_error) return auth_error;

  try {
    const { content } = await request.json();

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const id = await create_suggestion(content.trim());

    return NextResponse.json({
      success: true,
      id,
      message: 'Suggestion created'
    });
  } catch (error) {
    console.error('POST suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to create suggestion' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth_error = await require_auth(request);
  if (auth_error) return auth_error;

  try {
    const { id, status, outcome } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Suggestion ID is required' },
        { status: 400 }
      );
    }

    const valid_statuses: Suggestion['status'][] = ['pending', 'considering', 'done', 'rejected'];
    if (!status || !valid_statuses.includes(status)) {
      return NextResponse.json(
        { error: 'Valid status is required: pending, considering, done, rejected' },
        { status: 400 }
      );
    }

    const updated = await update_suggestion(id, status, outcome);

    if (!updated) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Suggestion updated'
    });
  } catch (error) {
    console.error('PATCH suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to update suggestion' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth_error = await require_auth(request);
  if (auth_error) return auth_error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Suggestion ID is required' },
        { status: 400 }
      );
    }

    const deleted = await delete_suggestion(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Suggestion deleted'
    });
  } catch (error) {
    console.error('DELETE suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to delete suggestion' },
      { status: 500 }
    );
  }
}
