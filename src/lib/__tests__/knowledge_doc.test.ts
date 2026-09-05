import { describe, it, expect } from 'vitest';
import { knowledge_subject, knowledge_filename } from '../knowledge_doc';

describe('knowledge_subject', () => {
  it('reads the first level-1 heading', () => {
    expect(knowledge_subject('# Trail Maintenance\n\nSome facts.')).toBe('Trail Maintenance');
  });

  it('skips preamble to find the heading', () => {
    expect(knowledge_subject('\n\n# Bike Fitting\n\n## Saddle height')).toBe('Bike Fitting');
  });

  it('ignores deeper headings when looking for the title', () => {
    expect(knowledge_subject('## Section\n\n# Real Title')).toBe('Real Title');
  });

  it('strips emphasis markers from the heading', () => {
    expect(knowledge_subject('# **Oura** Ring `data`')).toBe('Oura Ring data');
  });

  it('falls back to the first non-empty line when there is no heading', () => {
    expect(knowledge_subject('\n\nWheel building notes\nmore text')).toBe('Wheel building notes');
  });

  it('falls back to a constant for empty input', () => {
    expect(knowledge_subject('   \n\n  ')).toBe('Knowledge');
  });
});

describe('knowledge_filename', () => {
  it('joins the subject with underscores', () => {
    expect(knowledge_filename('# Trail Maintenance')).toBe('Trail_Maintenance.md');
  });

  it('drops punctuation that is awkward in a filename', () => {
    expect(knowledge_filename('# Bill\'s Notes: Q4/2026 (draft)')).toBe('Bills_Notes_Q4_2026_draft.md');
  });

  it('treats hyphens as word breaks', () => {
    expect(knowledge_filename('# Ride-with-GPS Setup')).toBe('Ride_with_GPS_Setup.md');
  });

  it('truncates a long subject at a word boundary', () => {
    const name = knowledge_filename('# ' + 'longword '.repeat(12));
    expect(name.length).toBeLessThanOrEqual(63);
    expect(name.endsWith('.md')).toBe(true);
    expect(name).not.toContain('_.md');
  });

  it('falls back when the subject has no usable characters', () => {
    expect(knowledge_filename('# ***')).toBe('Knowledge.md');
  });

  it('handles empty input', () => {
    expect(knowledge_filename('')).toBe('Knowledge.md');
  });
});
