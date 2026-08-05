export type StoryAuditIssueType =
  | 'malformed_url'
  | 'missing_href'
  | 'missing_src'
  | 'empty_anchor'
  | 'broken_image_tag'
  | 'broken_markup'
  | 'missing_images'
  | 'post_too_short'
  | 'missing_content';

export const STORY_AUDIT_ISSUE_LABELS: Record<StoryAuditIssueType, string> = {
  malformed_url: 'Malformed URL',
  missing_href: 'Missing href',
  missing_src: 'Missing src',
  empty_anchor: 'Empty anchor',
  broken_image_tag: 'Broken image tag',
  broken_markup: 'Broken markup',
  missing_images: 'Missing images',
  post_too_short: 'Post too short',
  missing_content: 'Missing content',
};

export interface StoryAuditIssue {
  type: StoryAuditIssueType;
  message: string;
  line: number | null;
}

export interface StoryAuditSource {
  post_id: string;
  title: string;
  url: string;
  urls_used: string[];
  issue_count: number;
  issues: StoryAuditIssue[];
}

export interface StoryAudit {
  sources: StoryAuditSource[];
  summary: {
    source_count: number;
    sources_with_issues: number;
    issue_count: number;
  };
}

export interface AuditableSourcePost {
  post_id: string;
  title: string;
  url: string;
  content_html: string | null;
}

function line_for_index(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

function strip_html(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function read_attr(tag_attrs: string, attr: string): string | null {
  const pattern = new RegExp(`\\b${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag_attrs.match(pattern);

  if (!match) {
    return null;
  }

  return match[1] || match[2] || match[3] || '';
}

function is_malformed_url(value: string): boolean {
  if (!value) {
    return true;
  }

  if (value.startsWith('#') || value.startsWith('/') || value.startsWith('data:')) {
    return false;
  }

  try {
    const parsed = new URL(value, 'https://8i11.substack.com');
    return !['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return true;
  }
}

function find_broken_image_tags(html: string): StoryAuditIssue[] {
  const issues: StoryAuditIssue[] = [];
  let index = html.indexOf('<img');

  while (index !== -1) {
    const tail = html.slice(index + 4);
    const next_tag_end = tail.indexOf('>');
    const next_tag_start = tail.indexOf('<');

    if (next_tag_end === -1 || (next_tag_start !== -1 && next_tag_start < next_tag_end)) {
      issues.push({
        type: 'broken_image_tag',
        message: 'Image tag appears to be structurally incomplete.',
        line: line_for_index(html, index),
      });
    }

    index = html.indexOf('<img', index + 4);
  }

  return issues;
}

/**
 * Posts under this many sentences are stubs worth revisiting. They stay in the
 * story — the flag just makes them easy to find later.
 */
const SHORT_POST_SENTENCE_LIMIT = 3;

/**
 * Hosts that used to serve images for these posts and no longer do. Imgur links
 * still resolve (they serve a "removed" placeholder), so liveness cannot be
 * probed over the network — the host itself is the signal.
 */
const DEAD_IMAGE_HOSTS = ['imgur.com'];

/** WordPress shortcodes that should never survive into rendered post content. */
const WORDPRESS_SHORTCODE_NAMES = [
  'gallery',
  'caption',
  'wp_caption',
  'embed',
  'playlist',
  'audio',
  'video',
  'slideshow',
  'youtube',
  'vimeo',
  'soundcloud',
];

/** Shortcodes that stand in for images, so their absence means a lost gallery. */
const IMAGE_SHORTCODE_NAMES = ['gallery', 'caption', 'wp_caption', 'slideshow', 'playlist'];

const SHORTCODE_REGEX = new RegExp(
  `\\[\\/?(?:${WORDPRESS_SHORTCODE_NAMES.join('|')})\\b[^\\]]*\\]`,
  'gi'
);

const WP_BLOCK_COMMENT_REGEX = /<!--\s*\/?\s*wp:[\w/-]+[^>]*-->/gi;

/** Tags that read as plain text once entity-escaped markup leaks into a post. */
const ESCAPED_TAG_REGEX = /<\/?(?:img|a|div|figure|figcaption|iframe|span|p)\b[^<]{0,200}>/i;

const IMGUR_URL_REGEX = /https?:\/\/(?:[a-z0-9-]+\.)?imgur\.com\/[^\s"'<>)\]]+/gi;

function host_of(value: string): string | null {
  try {
    return new URL(value, 'https://8i11.substack.com').hostname.toLowerCase();
  } catch {
    return null;
  }
}

function is_dead_image_host(value: string): boolean {
  const host = host_of(value);

  if (!host) {
    return false;
  }

  return DEAD_IMAGE_HOSTS.some(dead => host === dead || host.endsWith(`.${dead}`));
}

/**
 * Split post content into sentences. Block-level tags count as sentence breaks
 * so that paragraphs without terminal punctuation are not merged into one.
 */
function split_sentences(html: string): string[] {
  const marked = html
    // Leaked shortcodes are not prose and must not pad the sentence count.
    .replace(SHORTCODE_REGEX, ' ')
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote|figcaption)>|<br\s*\/?>/gi, ' . ');

  return strip_html(marked)
    .split(/(?<=[.!?])["'”’)\]]*\s+/)
    .map(sentence => sentence.trim())
    .filter(sentence => /[a-z0-9]/i.test(sentence));
}

function count_words(html: string): number {
  const text = strip_html(html);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

/**
 * Flag WordPress leftovers that render as literal text instead of markup:
 * shortcodes, block comments, and entity-escaped tags.
 */
function find_broken_markup(html: string): StoryAuditIssue[] {
  const issues: StoryAuditIssue[] = [];
  const text = strip_html(html);
  const has_image = /<img\b/i.test(html);
  const seen_shortcodes = new Set<string>();

  let shortcode_match: RegExpExecArray | null;
  SHORTCODE_REGEX.lastIndex = 0;
  while ((shortcode_match = SHORTCODE_REGEX.exec(text)) !== null) {
    const shortcode = shortcode_match[0];
    const name = (/^\[\/?\s*([a-z_]+)/i.exec(shortcode)?.[1] || '').toLowerCase();

    // Dedupe by shortcode name so an opening and closing pair reads as one problem.
    if (seen_shortcodes.has(name)) {
      continue;
    }
    seen_shortcodes.add(name);

    const expects_image = IMAGE_SHORTCODE_NAMES.includes(name);
    const index = html.indexOf(shortcode);

    issues.push({
      type: 'broken_markup',
      message:
        expects_image && !has_image
          ? `WordPress [${name}] markup left as plain text and the post has no images: ${shortcode}`
          : `WordPress [${name}] markup left as plain text: ${shortcode}`,
      line: index === -1 ? null : line_for_index(html, index),
    });
  }

  let comment_match: RegExpExecArray | null;
  WP_BLOCK_COMMENT_REGEX.lastIndex = 0;
  while ((comment_match = WP_BLOCK_COMMENT_REGEX.exec(html)) !== null) {
    issues.push({
      type: 'broken_markup',
      message: `Leftover WordPress block markup: ${comment_match[0]}`,
      line: line_for_index(html, comment_match.index),
    });
  }

  const escaped_tag = text.match(ESCAPED_TAG_REGEX);
  if (escaped_tag) {
    issues.push({
      type: 'broken_markup',
      message: `Escaped HTML is rendering as plain text: ${escaped_tag[0].slice(0, 80)}`,
      line: null,
    });
  }

  return issues;
}

/**
 * Flag references to image hosts that no longer serve these photos, whether they
 * appear as an image source, a link, or a bare URL left in the text.
 */
function find_missing_images(html: string): StoryAuditIssue[] {
  const issues: StoryAuditIssue[] = [];
  const seen = new Set<string>();

  const add = (url: string, index: number | null) => {
    const key = url.toLowerCase();

    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    issues.push({
      type: 'missing_images',
      message: `Image is hosted on a retired host and no longer loads: ${url}`,
      line: index === null ? null : line_for_index(html, index),
    });
  };

  const tag_regex = /<(img|a)\b([^>]*)>/gi;
  let tag_match: RegExpExecArray | null;
  while ((tag_match = tag_regex.exec(html)) !== null) {
    const attrs = tag_match[2] || '';
    const value = tag_match[1].toLowerCase() === 'img'
      ? read_attr(attrs, 'src')
      : read_attr(attrs, 'href');

    if (value && is_dead_image_host(value)) {
      add(value, tag_match.index);
    }
  }

  const text = strip_html(html);
  let text_match: RegExpExecArray | null;
  IMGUR_URL_REGEX.lastIndex = 0;
  while ((text_match = IMGUR_URL_REGEX.exec(text)) !== null) {
    const index = html.indexOf(text_match[0]);
    add(text_match[0], index === -1 ? null : index);
  }

  return issues;
}

export function build_story_audit(posts: AuditableSourcePost[]): StoryAudit {
  const sources = posts.map((post): StoryAuditSource => {
    const issues: StoryAuditIssue[] = [];
    const urls_used: string[] = [];
    const html = post.content_html || '';

    if (!post.title.trim() || !post.post_id.trim() || !html.trim()) {
      issues.push({
        type: 'missing_content',
        message: 'Post is missing expected content fields for auditing.',
        line: null,
      });
    }

    const anchor_tag_regex = /<a\b([^>]*)>/gi;
    let anchor_match: RegExpExecArray | null;
    while ((anchor_match = anchor_tag_regex.exec(html)) !== null) {
      const attrs = anchor_match[1] || '';
      const href = read_attr(attrs, 'href');

      if (href === null) {
        issues.push({
          type: 'missing_href',
          message: 'Anchor tag is missing an href attribute.',
          line: line_for_index(html, anchor_match.index),
        });
        continue;
      }

      urls_used.push(href);

      if (is_malformed_url(href)) {
        issues.push({
          type: 'malformed_url',
          message: `Malformed URL found in href: ${href}`,
          line: line_for_index(html, anchor_match.index),
        });
      }
    }

    const anchor_body_regex = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
    let anchor_body_match: RegExpExecArray | null;
    while ((anchor_body_match = anchor_body_regex.exec(html)) !== null) {
      const body = anchor_body_match[1] || '';
      const text = strip_html(body);
      const has_image = /<img\b/i.test(body);

      if (!text && !has_image) {
        issues.push({
          type: 'empty_anchor',
          message: 'Anchor tag has no readable text content.',
          line: line_for_index(html, anchor_body_match.index),
        });
      }
    }

    const image_tag_regex = /<img\b([^>]*)>/gi;
    let image_match: RegExpExecArray | null;
    while ((image_match = image_tag_regex.exec(html)) !== null) {
      const attrs = image_match[1] || '';
      const src = read_attr(attrs, 'src');

      if (src === null) {
        issues.push({
          type: 'missing_src',
          message: 'Image tag is missing a src attribute.',
          line: line_for_index(html, image_match.index),
        });
        continue;
      }

      urls_used.push(src);

      if (is_malformed_url(src)) {
        issues.push({
          type: 'malformed_url',
          message: `Malformed URL found in src: ${src}`,
          line: line_for_index(html, image_match.index),
        });
      }
    }

    issues.push(...find_broken_image_tags(html));
    issues.push(...find_broken_markup(html));
    issues.push(...find_missing_images(html));

    if (html.trim()) {
      const sentences = split_sentences(html);

      if (sentences.length > 0 && sentences.length <= SHORT_POST_SENTENCE_LIMIT) {
        const words = count_words(html);
        issues.push({
          type: 'post_too_short',
          message: `Post is only ${sentences.length} sentence${sentences.length === 1 ? '' : 's'} (${words} word${words === 1 ? '' : 's'}) — likely a stub worth expanding.`,
          line: null,
        });
      }
    }

    const unique_urls = Array.from(new Set(urls_used));

    return {
      post_id: post.post_id,
      title: post.title,
      url: post.url,
      urls_used: unique_urls,
      issue_count: issues.length,
      issues,
    };
  });

  const issue_count = sources.reduce((total, source) => total + source.issue_count, 0);
  const sources_with_issues = sources.filter(source => source.issue_count > 0).length;

  return {
    sources,
    summary: {
      source_count: sources.length,
      sources_with_issues,
      issue_count,
    },
  };
}
