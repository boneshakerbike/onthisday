/**
 * Substack title helpers — anti-cliche detection, duplicate detection, and
 * output parsing for the `substack` mode of /api/clean-text.
 *
 * Pure functions only (no DB, no network) so they stay unit-testable.
 */

export interface TitlePair {
  title: string;
  subtitle: string;
}

const STOPWORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'is',
  'it', 'its', 'my', 'of', 'on', 'or', 'the', 'this', 'to', 'up', 'with', 'your',
]);

/** Lowercase, strip punctuation and collapse whitespace for comparison. */
export function normalize_title(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function content_words(raw: string): string[] {
  return normalize_title(raw)
    .split(' ')
    .filter(w => w.length > 0 && !STOPWORDS.has(w));
}

/**
 * Overdone title shapes. These are the "pre-made cheesy" templates — anything
 * matching gets rejected and regenerated rather than shipped.
 */
export const CLICHE_PATTERNS: Array<{ name: string; test: RegExp }> = [
  { name: '"... Again"', test: /\bagain$/ },
  { name: '"When Your/When The ..."', test: /^when (your|the|you|i|it|a) \b/ },
  { name: '"The Art of ..."', test: /^the (art|zen|joy|beauty|magic|power) of\b/ },
  { name: '"A Love Letter to ..."', test: /^(a )?love letter to\b/ },
  { name: '"In Praise of ..."', test: /^in (praise|defense|defence) of\b/ },
  { name: '"Notes/Dispatches/Postcards from ..."', test: /^(notes|dispatches|postcards|letters|scenes|report) from\b/ },
  { name: '"Confessions of ..."', test: /^confessions of\b/ },
  { name: '"Adventures in ..."', test: /^adventures in\b/ },
  { name: '"The Trouble With ..."', test: /^the (trouble|problem) with\b/ },
  { name: '"Tales of/from ..."', test: /^tales? (of|from)\b/ },
  { name: '"Lessons from/in ..."', test: /^lessons (from|in)\b/ },
  { name: '"A Brief History of ..."', test: /^a (brief|short) history of\b/ },
  { name: '"Chasing ..."', test: /^chasing\b/ },
  { name: '"That Time I ..."', test: /^that time (i|we)\b/ },
  { name: '"How I .../Why I ..."', test: /^(how|why) (i|we|you) \b/ },
  { name: '"On X and Y"', test: /^on \w+ and \w+$/ },
  { name: '"... Gone Wrong"', test: /\bgone (wrong|sideways|right)$/ },
  { name: '"The X Chronicles/Diaries/Files"', test: /\b(chronicles|diaries|files|edition|saga)$/ },
  { name: '"Welcome to ..."', test: /^welcome to\b/ },
  { name: '"Everything I/You ..."', test: /^everything (i|you|we)\b/ },
  { name: '"... : A Love Story"', test: /\ba (love )?story$/ },
  { name: '"In Which ..."', test: /^in which\b/ },
  { name: '"The Day I/The Day The ..."', test: /^the day (i|we|the|my)\b/ },
  { name: '"Anatomy of ..."', test: /^anatomy of\b/ },
  { name: '"Ode to ..."', test: /^(an )?ode to\b/ },
  { name: '"... 101"', test: /\b101$/ },
  { name: '"... , Revisited"', test: /\brevisited$/ },
  { name: '"Small Things/Little Things ..."', test: /^(small|little|quiet|simple) (things|moments|joys|victories)\b/ },
];

/** Returns the name of the overdone template a title matches, or null. */
export function find_cliche_pattern(title: string): string | null {
  const norm = normalize_title(title);
  if (!norm) return null;
  for (const { name, test } of CLICHE_PATTERNS) {
    if (test.test(norm)) return name;
  }
  return null;
}

/**
 * True when `title` is the same as, or a close rewording of, a previous title.
 * Close = identical after normalization, or >= 60% content-word overlap.
 */
export function is_duplicate_title(title: string, previous: string[]): boolean {
  const norm = normalize_title(title);
  if (!norm) return false;

  const words = new Set(content_words(title));

  for (const prev of previous) {
    const prev_norm = normalize_title(prev);
    if (!prev_norm) continue;
    if (prev_norm === norm) return true;

    const prev_words = new Set(content_words(prev));
    if (words.size === 0 || prev_words.size === 0) continue;

    let shared = 0;
    for (const w of words) if (prev_words.has(w)) shared++;
    const union = words.size + prev_words.size - shared;
    if (union > 0 && shared / union >= 0.6) return true;
  }

  return false;
}

/**
 * Rotating title angles. A random couple are injected into each prompt so
 * successive generations approach the title from different directions instead
 * of settling into one house style.
 */
export const TITLE_ANGLES: string[] = [
  'name a specific, concrete object from the story and let it carry the whole title',
  'use a flat understatement that undersells what actually happened',
  'borrow the register of an official notice, form, or incident report',
  'lead with a number or quantity that sounds oddly precise',
  'misapply a technical or bureaucratic term to something domestic',
  'write it as a fragment of overheard speech',
  'state a plain fact from the story that sounds absurd out of context',
  'name what did NOT happen instead of what did',
  'pair two nouns from the story that have no business together',
  'use the vocabulary of a completely unrelated field (finance, law, geology, sports officiating)',
  'phrase it as a self-assessment or verdict on yourself',
  'name the day by its least impressive accomplishment',
  'use a verb that is too dramatic for the thing it describes',
  'title it after the rule, excuse, or superstition at the center of the story',
  'let a piece of equipment or an animal be the subject doing the acting',
  'use a comparison to something mundane and slightly unflattering',
];

/** Pick `count` distinct angles at random. */
export function pick_title_angles(count: number, rand: () => number = Math.random): string[] {
  const pool = [...TITLE_ANGLES];
  const picked: string[] = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rand() * pool.length) % pool.length;
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

export interface ParsedSubstack {
  title: string;
  subtitle: string;
  alternates: TitlePair[];
}

const TITLE_LINE = /^\s*title\s*:\s*(.+)$/i;
const SUBTITLE_LINE = /^\s*sub\s*-?\s*title\s*:\s*(.+)$/i;
const ALTERNATES_HEADER = /^\s*(alternate|alternative)\s+titles?\s*:?\s*$/i;
/** e.g. "3. Title: Foo | Sub Title: Bar" */
const ALTERNATE_LINE = /^\s*(?:[-*]|\d+[.)])?\s*title\s*:\s*(.+?)\s*\|\s*sub\s*-?\s*title\s*:\s*(.+?)\s*$/i;

/** Pull the headline pair and the alternate options out of the model's output. */
export function parse_substack_output(text: string): ParsedSubstack {
  const lines = text.split('\n');
  let title = '';
  let subtitle = '';
  const alternates: TitlePair[] = [];
  let in_alternates = false;

  for (const line of lines) {
    if (ALTERNATES_HEADER.test(line)) {
      in_alternates = true;
      continue;
    }

    if (in_alternates) {
      const alt = line.match(ALTERNATE_LINE);
      if (alt) alternates.push({ title: alt[1].trim(), subtitle: alt[2].trim() });
      continue;
    }

    if (!title) {
      const t = line.match(TITLE_LINE);
      if (t) { title = t[1].trim(); continue; }
    }
    if (!subtitle) {
      const s = line.match(SUBTITLE_LINE);
      if (s) subtitle = s[1].trim();
    }
  }

  return { title, subtitle, alternates };
}

/** Every title the model offered in one generation (headline + alternates). */
export function all_offered_pairs(parsed: ParsedSubstack): TitlePair[] {
  const pairs: TitlePair[] = [];
  if (parsed.title) pairs.push({ title: parsed.title, subtitle: parsed.subtitle });
  for (const alt of parsed.alternates) {
    if (alt.title) pairs.push(alt);
  }
  return pairs;
}

export interface TitleProblem {
  title: string;
  reason: string;
}

/**
 * Check the headline and every alternate against the cliche templates and the
 * used-title history. Returns one problem per offending title.
 */
export function find_title_problems(parsed: ParsedSubstack, previous: string[]): TitleProblem[] {
  const problems: TitleProblem[] = [];
  const seen_this_run: string[] = [];

  for (const pair of all_offered_pairs(parsed)) {
    const cliche = find_cliche_pattern(pair.title);
    if (cliche) {
      problems.push({ title: pair.title, reason: `uses the overdone ${cliche} template` });
    } else if (is_duplicate_title(pair.title, previous)) {
      problems.push({ title: pair.title, reason: 'repeats a title already used on a previous post' });
    } else if (is_duplicate_title(pair.title, seen_this_run)) {
      problems.push({ title: pair.title, reason: 'is a reword of another option in this same batch' });
    }
    seen_this_run.push(pair.title);
  }

  return problems;
}
