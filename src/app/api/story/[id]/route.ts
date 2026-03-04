import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { auth_options } from '@/lib/auth';
import { update_story } from '@/lib/db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(auth_options);
  if (!session) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const blurb = typeof body.blurb === 'string' ? body.blurb.trim() : body.blurb === null ? null : undefined;

    if (!content) {
      return NextResponse.json(
        { error: 'Story content is required' },
        { status: 400 }
      );
    }

    const story = await update_story(id, content, blurb);

    if (!story) {
      return NextResponse.json(
        { error: 'Story not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, story });
  } catch (error) {
    console.error('Story update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update story' },
      { status: 500 }
    );
  }
}
