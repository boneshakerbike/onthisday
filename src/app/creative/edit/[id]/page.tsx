import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { auth_options } from '@/lib/auth';
import { get_story, get_story_audit } from '@/lib/db';
import StoryEditor from './editor_client';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CreativeEditPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getServerSession(auth_options);

  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/creative/edit/${id}`)}`);
  }

  const story = await get_story(id);

  if (!story) {
    notFound();
  }

  const audit_record = await get_story_audit(id);

  return (
    <StoryEditor
      story={{
        id: story.id,
        date_display: story.date_display,
        content: story.content,
        blurb: story.blurb,
        image_url: story.image_url,
        edited_at: story.edited_at,
      }}
      initial_audit={audit_record?.audit || null}
      initial_audit_updated_at={audit_record?.updated_at || null}
    />
  );
}
