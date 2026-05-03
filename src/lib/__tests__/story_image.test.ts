import { describe, it, expect } from 'vitest';
import { collect_image_candidates, pick_story_image_url } from '../story_image';

describe('collect_image_candidates', () => {
  it('returns an empty list when there is no content', () => {
    expect(collect_image_candidates([])).toEqual([]);
    expect(collect_image_candidates([{ content_html: null }])).toEqual([]);
    expect(collect_image_candidates([{ content_html: '' }])).toEqual([]);
  });

  it('extracts plain <img> URLs', () => {
    const posts = [
      { content_html: '<p>hi</p><img src="https://example.com/photo.jpg" />' },
    ];
    expect(collect_image_candidates(posts)).toEqual(['https://example.com/photo.jpg']);
  });

  it('skips data URIs and tracking pixels', () => {
    const posts = [
      { content_html: '<img src="data:image/png;base64,AAAA" />' },
      { content_html: '<img src="https://example.com/pixel.gif" />' },
      { content_html: '<img src="https://example.com/tracking.png" />' },
      { content_html: '<img src="https://example.com/photo.jpg" />' },
    ];
    expect(collect_image_candidates(posts)).toEqual(['https://example.com/photo.jpg']);
  });

  it('skips video file URLs accidentally placed in <img> src', () => {
    const posts = [
      { content_html: '<img src="https://example.com/clip.mp4" />' },
      { content_html: '<img src="https://example.com/clip.webm?v=1" />' },
      { content_html: '<img src="https://example.com/photo.jpg" />' },
    ];
    expect(collect_image_candidates(posts)).toEqual(['https://example.com/photo.jpg']);
  });

  it('skips images contained inside <video> blocks', () => {
    const posts = [
      {
        content_html: `
          <video poster="https://example.com/poster.jpg">
            <source src="https://example.com/clip.mp4" />
            <img src="https://example.com/inside-video.jpg" />
          </video>
          <img src="https://example.com/real.jpg" />
        `,
      },
    ];
    expect(collect_image_candidates(posts)).toEqual(['https://example.com/real.jpg']);
  });

  it('keeps Substack CDN image fetch URLs without extensions', () => {
    const posts = [
      {
        content_html:
          '<img src="https://substackcdn.com/image/fetch/w_1456,c_limit/abc123" />',
      },
    ];
    expect(collect_image_candidates(posts)).toEqual([
      'https://substackcdn.com/image/fetch/w_1456,c_limit/abc123',
    ]);
  });

  it('rejects non-image URLs without recognizable extensions', () => {
    const posts = [
      { content_html: '<img src="https://example.com/some/path/noext" />' },
    ];
    expect(collect_image_candidates(posts)).toEqual([]);
  });

  it('deduplicates repeated URLs', () => {
    const posts = [
      { content_html: '<img src="https://example.com/a.jpg" /><img src="https://example.com/a.jpg" />' },
      { content_html: '<img src="https://example.com/a.jpg" />' },
    ];
    expect(collect_image_candidates(posts)).toEqual(['https://example.com/a.jpg']);
  });

  it('collects images from across multiple posts', () => {
    const posts = [
      { content_html: '<img src="https://example.com/a.jpg" />' },
      { content_html: '<img src="https://example.com/b.png" />' },
      { content_html: '<img src="https://example.com/c.webp" />' },
    ];
    expect(collect_image_candidates(posts)).toEqual([
      'https://example.com/a.jpg',
      'https://example.com/b.png',
      'https://example.com/c.webp',
    ]);
  });
});

describe('pick_story_image_url', () => {
  it('returns null when there are no candidates', () => {
    expect(pick_story_image_url([])).toBeNull();
    expect(pick_story_image_url([{ content_html: '<img src="data:foo" />' }])).toBeNull();
  });

  it('picks a candidate using the supplied randomizer', () => {
    const posts = [
      { content_html: '<img src="https://example.com/a.jpg" />' },
      { content_html: '<img src="https://example.com/b.jpg" />' },
      { content_html: '<img src="https://example.com/c.jpg" />' },
    ];
    expect(pick_story_image_url(posts, () => 0)).toBe('https://example.com/a.jpg');
    expect(pick_story_image_url(posts, () => 0.5)).toBe('https://example.com/b.jpg');
    expect(pick_story_image_url(posts, () => 0.9999)).toBe('https://example.com/c.jpg');
  });
});
