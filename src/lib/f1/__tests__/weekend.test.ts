/**
 * Weekend structure tests
 * Spec: STANDARD_WEEKEND and SPRINT_WEEKEND arrays from types.ts
 */

import { describe, it, expect } from 'vitest';
import { STANDARD_WEEKEND, SPRINT_WEEKEND } from '../types';
import type { SessionType } from '../types';

describe('weekend structure', () => {
  it('standard weekend has qualifying and race in that order', () => {
    expect(STANDARD_WEEKEND).toEqual(['qualifying', 'race']);
  });

  it('sprint weekend has all four sessions in step-lock order', () => {
    expect(SPRINT_WEEKEND).toEqual(['sprint_qualifying', 'sprint', 'qualifying', 'race']);
  });

  it('sprint_qualifying comes before sprint', () => {
    const sq = SPRINT_WEEKEND.indexOf('sprint_qualifying');
    const s = SPRINT_WEEKEND.indexOf('sprint');
    expect(sq).toBeLessThan(s);
  });

  it('qualifying comes before race in both weekends', () => {
    const std_q = STANDARD_WEEKEND.indexOf('qualifying');
    const std_r = STANDARD_WEEKEND.indexOf('race');
    expect(std_q).toBeLessThan(std_r);

    const sp_q = SPRINT_WEEKEND.indexOf('qualifying');
    const sp_r = SPRINT_WEEKEND.indexOf('race');
    expect(sp_q).toBeLessThan(sp_r);
  });

  it('sprint weekend contains all standard weekend sessions', () => {
    for (const session of STANDARD_WEEKEND) {
      expect(SPRINT_WEEKEND).toContain(session);
    }
  });

  it('all session types are valid SessionType values', () => {
    const valid: SessionType[] = ['sprint_qualifying', 'qualifying', 'sprint', 'race'];
    for (const s of [...STANDARD_WEEKEND, ...SPRINT_WEEKEND]) {
      expect(valid).toContain(s);
    }
  });

  it('no duplicate sessions within a weekend', () => {
    expect(new Set(STANDARD_WEEKEND).size).toBe(STANDARD_WEEKEND.length);
    expect(new Set(SPRINT_WEEKEND).size).toBe(SPRINT_WEEKEND.length);
  });
});
