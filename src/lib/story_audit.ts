export type StoryAuditIssueType =
  | 'malformed_url'
  | 'missing_href'
  | 'missing_src'
  | 'empty_anchor'
  | 'broken_image_tag'
  | 'missing_content';

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
