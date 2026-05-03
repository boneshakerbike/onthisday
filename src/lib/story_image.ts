/**
 * Pick a renderable image URL from a set of source posts for use as a
 * story's featured image. Skips video sources, tracking pixels, and
 * other URLs that are unlikely to render as a static <img>.
 */

export interface PostWithHtml {
  content_html?: string | null;
}

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.ogv', '.avi', '.mkv'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
const TRACKING_HINTS = ['pixel', 'tracking', 'beacon', 'spacer', '1x1', 'blank.gif', 'open.gif'];

function strip_video_blocks(html: string): string {
  return html.replace(/<video[\s\S]*?<\/video>/gi, '');
}

function looks_like_image_url(url: string): boolean {
  const lower = url.toLowerCase().split('?')[0].split('#')[0];

  if (IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext))) {
    return true;
  }

  // Substack proxies images through this CDN path even without an extension.
  if (/substackcdn\.com\/image\//.test(lower)) {
    return true;
  }

  return false;
}

function is_disqualified(url: string): boolean {
  if (!url) return true;
  if (url.startsWith('data:')) return true;

  const lower = url.toLowerCase();

  if (VIDEO_EXTENSIONS.some(ext => lower.split('?')[0].endsWith(ext))) return true;
  if (TRACKING_HINTS.some(hint => lower.includes(hint))) return true;

  return false;
}

export function collect_image_candidates(posts: PostWithHtml[]): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const post of posts) {
    if (!post.content_html) continue;

    const html = strip_video_blocks(post.content_html);
    const matches = html.matchAll(/<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi);

    for (const match of matches) {
      const src = match[1].trim();
      if (is_disqualified(src)) continue;
      if (!looks_like_image_url(src)) continue;
      if (seen.has(src)) continue;

      seen.add(src);
      candidates.push(src);
    }
  }

  return candidates;
}

export function pick_story_image_url(
  posts: PostWithHtml[],
  rand: () => number = Math.random
): string | null {
  const candidates = collect_image_candidates(posts);
  if (candidates.length === 0) return null;

  const index = Math.floor(rand() * candidates.length);
  return candidates[Math.min(index, candidates.length - 1)];
}
