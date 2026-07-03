# Coach Roadmap

Source of truth for the coach overhaul that began 2026-07-03. GitHub issues may reference this doc, but if the issues disappear, this doc is enough to reconstruct the whole effort. Update it as work lands.

## Origin

Bill reviewed all 66 coaching sessions (2026-04-16 through 2026-07-02) pulled from the `coaching_history` table. Most sessions were ending in arguments instead of useful guidance. The review identified five root causes, all confirmed against transcripts and code.

## Root causes of coach friction

1. **Context amnesia (biggest).** `src/app/api/coaching/chat/route.ts` injects only the last 3 session summaries, truncated to 300 chars each. Everything Bill teaches the coach evaporates: e-assist calibration (taught 2026-04-28), daily three-workout routine (re-explained 2026-06-02), knee/ACL history (2026-06-05), "biking is regulatory" (2026-06-06), bike parks use lifts (2026-06-12 and again 2026-06-15). The coach concedes, forgets, and the same argument repeats.
2. **Data errors that destroy trust.** Wrong day of week (2026-06-26, Vercel runs UTC, Bill is Mountain time). Deep sleep attributed to the wrong night (2026-06-24). Hallucinated "shortened night" (2026-05-27). Bike-park descent elevation read as climbing effort (2026-06-15).
3. **Broken summaries feed forward.** The finalize route's auto-summarizer sometimes role-confuses and stores conversational refusals as the summary (see sessions 2026-04-22, 2026-04-26). Those become future context.
4. **Coach argued against Bill's philosophy instead of coaching within it.** Mostly fixed by the May system prompt rewrite. Remaining friction is causes 1 to 3.
5. **Oura advisor comparisons.** Bill pastes Oura advisor analysis and the coach caves. The advisor has 10 years of his data; our coach has 900 chars. Treat the Oura advisor as a rich context source to consult, not an argument opponent.

Also: "Note to developer" requests (at least 8 across the transcripts) are saved in `advice_full` but stripped by the summarizer and surfaced nowhere.

## The goal (Bill's words, 2026-07-03)

Guide him quickly, every morning, toward becoming a 99-year-old athlete: active and off meds as long as possible. The coach adapts but holds its ground, takes tantrums in stride, stays flexible for the future. Flexible, but the main goal is definitive.

## Coach memory design (agreed 2026-07-03)

Three layers:

1. **Core (definitive).** The longevity guidance framework from Bill's original studies (Master State of Knowledge). The coach never strays from it. Complaints are regulation, not amendments; repeated pressure never erodes it. Position changes require new information, never pressure alone. When Bill is going to ride regardless, coach the ride he's actually going to do instead of arguing.
2. **Living profile (flexible).** Facts and context: routine, equipment, injuries, calibrations, current focus. Editable in the app anytime. At session save, the coach proposes profile updates that Bill approves or rejects.
3. **Audit.** Every profile change (manual or accepted proposal) is checked against the core. Conflicts are flagged visibly but not blocked. Example: "beer is fine now" can go in the profile, but it carries a visible flag that it contradicts core guidance, and the coach keeps coaching from the core while acknowledging the exception.

**Seeding the core:** Bill's Master State of Knowledge studies live in `C:/Users/remote-admin/My Drive/Health/` (Google Drive). CAUTION: many studies exist there. Do not guess which one is current. Confirm with Bill which document is the Master SoK before seeding anything. The prompt library entries "Coach: New Weekly Session" and "Coach: Post Week Session SoK" reference the SoK workflow.

## Decisions locked with Bill (2026-07-03)

- Weight input stays typed (numeric). Blank on the road is intentional (no scale); the stale carry-forward tile is designed behavior.
- Back input: single 4-level tap selector, None / Mild / Moderate / Severe, numeric behind the scenes, starts unset so an untouched input saves null (currently an untouched slider saves a false 0/10). Replaces the slider and the back mobility notes box.
- Bowel input: 4-option tap selector, Loose / Normal / Hard / None, stored numerically so it can trend. Replaces free text.
- Notes field stays exactly as is. It is how Bill discusses context with the coach.
- Metrics pane collapses behind a "Today's data" header during sessions and can be reopened (shipped in PR #240).

## Status

### Done
- PR #240 (2026-07-03): mobile metric grid 3-col, uniform card heights, collapsible metrics pane during sessions, sessionStorage per-day cache for instant repaint on refresh. Tested by Bill.

### Remaining, in Bill's priority order
1. **Coach memory** (three-layer design above): two stored documents, injected every session, profile editable in app, propose-and-approve at save, audit flag on conflicts. Includes the "hold your ground" system prompt revision.
2. **Input standardization** (decisions above).
3. **Session robustness:**
   - Persist conversation and manual inputs to localStorage so refresh never loses a session (bit Bill on 2026-06-29 and 2026-07-03).
   - Fix day/date: compute in America/Denver and pass the weekday explicitly to the model.
   - Fix sleep-night labeling in data injection (last night vs tonight confusion).
   - Harden the finalize summarizer prompt and validate output before storing.
   - Developer-notes pipeline: detect "note to developer" in sessions, store, and surface them (page section or GitHub issue) instead of losing them in summaries.

## Regenerating the session dump

The full transcript dump (`coaching_sessions_dump.txt`, gitignored) is derived data. Safe to delete anytime; regenerate with Turso creds in `.env.local`:

```js
// dump_coaching_tmp.mjs — run from repo root: node dump_coaching_tmp.mjs > coaching_sessions_dump.txt
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
const r = await db.execute('SELECT date, advice_full, advice_summary, conversation_turns, token_count, created_at FROM coaching_history ORDER BY date ASC');
console.log('TOTAL SESSIONS:', r.rows.length);
for (const row of r.rows) {
  const d = new Date(Number(row.date) * 86400000).toISOString().split('T')[0];
  console.log(`\n========================================\nDATE: ${d} | turns: ${row.conversation_turns} | tokens: ${row.token_count}`);
  console.log('--- SUMMARY ---\n' + (row.advice_summary || '(none)'));
  console.log('--- FULL ---\n' + row.advice_full);
}
```
