import { describe, it, expect } from 'vitest';
import { build_issue_url, derive_issue_title, ISSUES_REPO } from '../github_issue';

describe('derive_issue_title', () => {
  it('uses the first sentence', () => {
    expect(derive_issue_title('Add a dark mode toggle. It should remember the choice.'))
      .toBe('Add a dark mode toggle');
  });

  it('uses the first non-empty line when there is no sentence break', () => {
    expect(derive_issue_title('\n\nFix the nav dropdown\nsecond line here'))
      .toBe('Fix the nav dropdown');
  });

  it('stops at the line break even when the sentence continues below', () => {
    expect(derive_issue_title('Short line\nrest of the sentence.')).toBe('Short line');
  });

  it('truncates long titles at a word boundary', () => {
    const title = derive_issue_title('a'.repeat(10) + ' ' + 'word '.repeat(40) + 'end.');
    expect(title.length).toBeLessThanOrEqual(73);
    expect(title.endsWith('...')).toBe(true);
    expect(title).not.toContain('  ');
  });

  it('truncates mid-word when there is no early word boundary', () => {
    const title = derive_issue_title('x'.repeat(200));
    expect(title).toBe('x'.repeat(70) + '...');
  });

  it('falls back to a placeholder for empty text', () => {
    expect(derive_issue_title('   \n  ')).toBe('Note from Say What?');
  });
});

describe('build_issue_url', () => {
  it('builds a prefilled new-issue URL for the repo', () => {
    const { url, truncated } = build_issue_url('Add a dark mode toggle. Remember it.');
    expect(truncated).toBe(false);
    expect(url.startsWith(`https://github.com/${ISSUES_REPO}/issues/new?`)).toBe(true);

    const params = new URL(url).searchParams;
    expect(params.get('title')).toBe('Add a dark mode toggle');
    expect(params.get('body')).toBe('Add a dark mode toggle. Remember it.');
  });

  it('escapes characters that would otherwise break the query string', () => {
    const body = 'Bug: a&b = c #42 100% "quoted"';
    const params = new URL(build_issue_url(body).url).searchParams;
    expect(params.get('body')).toBe(body);
  });

  it('truncates an oversized body and says so', () => {
    const { url, truncated } = build_issue_url('long story '.repeat(2000));
    expect(truncated).toBe(true);
    expect(url.length).toBeLessThanOrEqual(6000);
    expect(new URL(url).searchParams.get('body')).toContain('...(truncated');
  });

  it('keeps the URL under the cap even when every character expands when encoded', () => {
    const { url, truncated } = build_issue_url('日'.repeat(4000));
    expect(truncated).toBe(true);
    expect(url.length).toBeLessThanOrEqual(6000);
  });

  it('accepts a different repo', () => {
    const { url } = build_issue_url('hello', 'someone/elsewhere');
    expect(url.startsWith('https://github.com/someone/elsewhere/issues/new?')).toBe(true);
  });
});
