/**
 * API route: GET /api/story?date=MM-DD
 * Returns the most recent story for a given date, if one exists
 */

import { NextRequest, NextResponse } from 'next/server';
import { get_story_by_date } from '@/lib/db';
import { extract_story_fallback_blurb } from '@/lib/story_markup';

export async function GET(request: NextRequest) {
  try {
    const date_key = request.nextUrl.searchParams.get('date');

    if (!date_key) {
      return NextResponse.json(
        { error: 'date parameter required (format: MM-DD)' },
        { status: 400 }
      );
    }

    const story = await get_story_by_date(date_key);

    if (!story) {
      return NextResponse.json({ story: null });
    }

    const fallback_blurb = extract_story_fallback_blurb(story.content);

    return NextResponse.json({
      story: {
        id: story.id,
        date_display: story.date_display,
        blurb: story.blurb || fallback_blurb,
        post_count: story.post_count,
        image_url: story.image_url,
        edited_at: story.edited_at,
        created_at: story.created_at,
      }
    });

  } catch (error) {
    console.error('Story fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch story' },
      { status: 500 }
    );
  }
}
