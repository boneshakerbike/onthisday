/**
 * API route: /api/stories
 * GET - List all stories (public)
 * DELETE - Delete a story by ID (requires auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { get_all_stories, delete_story } from '@/lib/db';
import { auth_options } from '@/lib/auth';

export async function GET() {
  try {
    const stories = await get_all_stories();
    return NextResponse.json({ success: true, stories });
  } catch (error) {
    console.error('Error fetching stories:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch stories' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Require authentication for delete
  const session = await getServerSession(auth_options);
  if (!session) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Story ID is required' },
        { status: 400 }
      );
    }

    const deleted = await delete_story(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Story not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting story:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete story' },
      { status: 500 }
    );
  }
}
