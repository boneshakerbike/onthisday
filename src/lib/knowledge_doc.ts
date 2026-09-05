/**
 * Naming for generated knowledge documents.
 *
 * The knowledge mode of /api/clean-text is prompted to open its output with a
 * single `# Subject` heading; that heading is what names the downloaded file, so
 * you get Trail_Maintenance.md rather than document.md.
 */

/** Filesystem-safe subject length. Long enough to stay descriptive, short enough to read. */
const MAX_SUBJECT = 60;

const FALLBACK_SUBJECT = 'Knowledge';

/**
 * The document's subject: the text of its first level-1 heading.
 *
 * Falls back to the first non-empty line (with any leading #s stripped) when the
 * model skips the heading, and to a constant when there is nothing usable at all.
 */
export function knowledge_subject(markdown: string): string {
  const lines = markdown.split('\n');

  const heading = lines.find(l => /^#\s+\S/.test(l.trim()));
  const source = heading ?? lines.find(l => l.trim());
  if (!source) return FALLBACK_SUBJECT;

  const text = source
    .trim()
    .replace(/^#+\s*/, '')      // heading markers
    .replace(/[*_`]/g, '')      // inline emphasis
    .trim();

  return text || FALLBACK_SUBJECT;
}

/**
 * Download filename for a knowledge document: the subject in Title_Case_With_
 * underscores, plus .md. Characters that are awkward in a filename on any of the
 * three desktop platforms are dropped rather than substituted.
 */
export function knowledge_filename(markdown: string): string {
  const words = knowledge_subject(markdown)
    .replace(/['\u2019]/g, '')            // possessives join up: Bill's -> Bills
    .replace(/[^A-Za-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean);

  if (words.length === 0) return `${FALLBACK_SUBJECT}.md`;

  let name = words.join('_');
  if (name.length > MAX_SUBJECT) {
    // Cut at a word boundary so the name stays readable.
    const clipped = name.slice(0, MAX_SUBJECT);
    const last_break = clipped.lastIndexOf('_');
    name = last_break > 10 ? clipped.slice(0, last_break) : clipped;
  }

  return `${name}.md`;
}
