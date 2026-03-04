export function extract_story_title(content: string, date_display: string): string {
  const title_match = content.match(/<h2[^>]*>([^<]+)<\/h2>/i);
  return title_match ? title_match[1] : `On This Day: ${date_display}`;
}

export function extract_story_fallback_blurb(content: string, max_length: number = 160): string | null {
  const first_paragraph = content.match(/<p[^>]*>(.*?)<\/p>/is);

  if (!first_paragraph || !first_paragraph[1]) {
    return null;
  }

  const text = first_paragraph[1]
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return null;
  }

  if (text.length <= max_length) {
    return text;
  }

  return `${text.slice(0, max_length).trimEnd()}...`;
}

export function build_story_body_html(content: string): string {
  return content
    .replace(/<h2[^>]*>[^<]+<\/h2>/i, '')
    .replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ')
    .trim();
}
