import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { auth_options } from '@/lib/auth';
import { get_post_url, get_posts_on_date, get_story, save_story_audit } from '@/lib/db';
import { build_story_audit } from '@/lib/story_audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_: Request, context: RouteContext) {
  const session = await getServerSession(auth_options);
  if (!session) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const { id } = await context.params;
    const story = await get_story(id);

    if (!story) {
      return NextResponse.json(
        { error: 'Story not found' },
        { status: 404 }
      );
    }

    const [month, day] = story.date_key.split('-').map(Number);
    const posts = await get_posts_on_date(month, day);
    const audit = build_story_audit(posts.map(post => ({
      post_id: post.post_id,
      title: post.title,
      url: get_post_url(post.post_id),
      content_html: post.content_html
    })));

    await save_story_audit(story.id, audit);

    return NextResponse.json({ success: true, audit });
  } catch (error) {
    console.error('Story audit rerun error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to re-run audit' },
      { status: 500 }
    );
  }
}
