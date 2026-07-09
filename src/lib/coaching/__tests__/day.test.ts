import { describe, it, expect } from 'vitest';
import { mt_date_str, mt_epoch_day, epoch_day_to_date_str } from '../day';

const DAY_MS = 86400000;
const utc_epoch_day = (d: Date) => Math.floor(d.getTime() / DAY_MS);

describe('Mountain Time day boundary', () => {
  it('keeps an MDT evening on the same Denver date after UTC rolls over', () => {
    // 2026-07-10 01:00 UTC = 2026-07-09 19:00 MDT (UTC-6)
    const evening = new Date('2026-07-10T01:00:00Z');
    expect(mt_date_str(evening)).toBe('2026-07-09');
    expect(mt_epoch_day(evening)).toBe(Date.UTC(2026, 6, 9) / DAY_MS);
    expect(mt_epoch_day(evening)).toBe(utc_epoch_day(evening) - 1);
  });

  it('keeps an MST evening on the same Denver date after UTC rolls over', () => {
    // 2026-01-10 02:00 UTC = 2026-01-09 19:00 MST (UTC-7)
    const evening = new Date('2026-01-10T02:00:00Z');
    expect(mt_date_str(evening)).toBe('2026-01-09');
    expect(mt_epoch_day(evening)).toBe(Date.UTC(2026, 0, 9) / DAY_MS);
  });

  it('agrees with the UTC epoch day during Denver daytime', () => {
    // 2026-07-09 15:00 UTC = 09:00 MDT — both schemes say July 9
    const morning = new Date('2026-07-09T15:00:00Z');
    expect(mt_epoch_day(morning)).toBe(utc_epoch_day(morning));
    expect(mt_date_str(morning)).toBe('2026-07-09');
  });

  it('round-trips epoch day to date string', () => {
    const evening = new Date('2026-07-10T01:00:00Z');
    expect(epoch_day_to_date_str(mt_epoch_day(evening))).toBe('2026-07-09');
    expect(epoch_day_to_date_str(mt_epoch_day(evening) - 1)).toBe('2026-07-08');
  });
});
