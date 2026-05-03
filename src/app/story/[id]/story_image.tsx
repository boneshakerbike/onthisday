/**
 * Featured story image with graceful fallback: if the URL fails to load
 * (e.g. an older story stored a video or hot-link-protected URL), the
 * image hides itself instead of rendering the browser's broken-image icon.
 */

'use client';

import { useState } from 'react';

interface StoryImageProps {
  src: string;
}

export default function StoryImage({ src }: StoryImageProps) {
  const [failed, set_failed] = useState(false);

  if (failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="story-image"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => set_failed(true)}
    />
  );
}
