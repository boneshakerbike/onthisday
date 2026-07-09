/**
 * Day-boundary helpers for coaching data.
 * Coaching tables key rows by an integer "epoch day", and the day boundary
 * is Mountain Time (America/Denver), not UTC — a session saved at 11pm in
 * Denver belongs to that Denver date even though UTC has rolled over.
 * Safe on both client and server (Vercel runs UTC).
 */

const MT_TIMEZONE = 'America/Denver';
const DAY_MS = 86400000;

/** YYYY-MM-DD for the current date in Mountain Time */
export function mt_date_str(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: MT_TIMEZONE });
}

/** Days since Unix epoch of the current Mountain Time calendar date */
export function mt_epoch_day(now: Date = new Date()): number {
  const [y, m, d] = mt_date_str(now).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

/** Convert a stored epoch day back to its YYYY-MM-DD calendar date */
export function epoch_day_to_date_str(epoch_day: number): string {
  return new Date(epoch_day * DAY_MS).toISOString().split('T')[0];
}
