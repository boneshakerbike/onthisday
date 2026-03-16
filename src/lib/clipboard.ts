/**
 * Copy to clipboard with HTML preferred, plain text fallback.
 * Works on Android Chrome, iOS Safari, and desktop browsers.
 *
 * IMPORTANT: Caller must NOT set React state or await anything before
 * calling this — re-renders before the call can cause focus loss on mobile,
 * killing clipboard permission.
 */
export async function copy_to_clipboard(
  html: string,
  text: string,
): Promise<'html' | 'text' | 'execcommand' | 'failed'> {
  // Tier 1: Async Clipboard API with dual MIME types in a single write call.
  // Including text/plain alongside text/html means paste targets pick the
  // format they need — no retry required.
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
      return 'html';
    } catch {
      // Gesture token is now consumed — do NOT retry with writeText here.
      // Fall through to execCommand which doesn't need fresh activation.
    }
  }

  // Tier 2: writeText — only when ClipboardItem is absent (tier 1 was skipped
  // entirely, so the gesture token is still intact).
  if (typeof ClipboardItem === 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return 'text';
    } catch {
      // Fall through
    }
  }

  // Tier 3: Synchronous execCommand — deprecated but universally supported.
  // Does not require transient activation; works as long as the doc has focus.
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    if (ok) return 'execcommand';
  } catch { /* ignore */ }

  return 'failed';
}
