/**
 * Centralized text normalization for all coaching/AI-generated output.
 * Applied server-side before returning responses and client-side as a safety net.
 */

/**
 * Normalize AI-generated text to remove patterns that read as machine-generated.
 * Add new rules here as they're identified.
 */
export function normalizeCoachText(text: string): string {
  let result = text;

  // Replace em dashes with commas (the most common AI-tell)
  result = result.replace(/\s*—\s*/g, ', ');

  // Replace en dashes used as em dashes (surrounded by spaces)
  result = result.replace(/\s+–\s+/g, ', ');

  return result;
}
