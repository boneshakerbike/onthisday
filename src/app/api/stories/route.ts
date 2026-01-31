/**
 * API route: /api/stories
 * GET - List all stories
 * DELETE - Delete a story by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { get_all_stories, delete_story } from '@/lib/db';

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
