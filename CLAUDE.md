# 8i11 — onthisday-next

**Live:** https://8i11.vercel.app | **Repo:** https://github.com/boneshakerbike/onthisday

> **Vercel access:** Use the `vercel` CLI (already installed, logged in as `boneshakerbike`, team `boneshakerbikes-projects`). Do NOT use the Vercel MCP plugin — its OAuth redirect is broken on Vercel's side and will error. The `/doctor` MCP auth warning at login is cosmetic; ignore it. Examples: `vercel projects ls`, `vercel ls`, `vercel logs <url>`, `vercel env ls`.

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 16.1.4 with App Router |
| Language | TypeScript 5.x |
| UI | React 19.2.3 + Tailwind CSS 4.x + @radix-ui/react-dropdown-menu |
| Database | Turso (libSQL) production / libSQL file driver local (data/posts.db) |
| Auth | NextAuth.js 4.24.13 (GitHub OAuth + Guest PIN) |
| AI | @anthropic-ai/sdk |
| Testing | vitest |

## Environment Note

This machine is a VM, **not** a dev environment. The app deploys via Vercel (pushes to `main` auto-deploy; PRs get previews) — nothing app-runtime needs to run locally. Do not start a local server to verify changes unless explicitly asked; use the Vercel preview instead. Local commands are only for the pre-PR gate: `npm run build`, `npm run lint`, `npx vitest`.

## Development Commands
```bash
npm run build    # Build for production (pre-PR gate)
npm run lint     # ESLint (pre-PR gate)
npx vitest       # Run tests (src/lib/f1/__tests__/)
npm start        # Local server on :3000 if ever needed (after build)
                 # Avoid `npm run dev` on this VM — Fast Refresh reload loop
```

## Project Structure
```
src/
  app/
    page.tsx                      # Landing page
    layout.tsx                    # Root layout + SessionProvider
    creative/
      page.tsx                    # On This Day: browse posts, generate stories
      archive/page.tsx            # Story archive (public)
      edit/[id]/page.tsx          # Story editor
      text-cleaner/               # Say What?: text cleaning + story builder
    story/[id]/page.tsx           # Shareable story page (public)
    tools/
      markdown/                   # Rich text → Markdown converter
      knowledge-diff/             # Compare knowledge docs
      prompt-library/             # Versioned prompt storage with AI review
      text-cleaner/               # Redirects to /creative/text-cleaner
      instruction-stripper/       # Strip instructions from text
      admin/                      # Admin reference
    health/
      wellness/page.tsx           # Health hub landing page
      oura/page.tsx               # Oura Ring dashboard
      ridewithgps/page.tsx        # Ride with GPS dashboard
      coros/page.tsx              # COROS dashboard
    games/
      f1/page.tsx                 # F1 Predictors Championship
      frogger/                    # Pixel art frogger
      breakout/                   # Brick breaker
    weather/page.tsx              # Weather (public)
    login/ privacy/ terms/
    archive/                      # Redirects to /creative/archive
    stories/                      # Redirects to /creative/archive
    tools/wellness/               # Redirects to /health/oura
    api/
      posts/ upload/ generate/
      sync/ story/ stories/
      intro/ clean-text/ strip/
      knowledge-diff/
      prompts/ prompts/review/
      oura/                       # OAuth: authorize callback data sync disconnect
      ridewithgps/                # data (Basic Auth, no OAuth)
      coros/                      # data save
      f1/                         # schedule drivers predict results leaderboard
                                  # lock reveal state player roster season_progress
                                  # mr-bear/stage mr-bear/poke mr-bear/rookies
                                  # admin/cancel-round
      health/ config/ auth/
  components/
    nav_tabs.tsx                  # Shared navigation (Radix UI dropdowns)
    session_provider.tsx
    f1/                           # 10 F1 UI components
  lib/
    db.ts                         # posts, stories, story_audits, mr_bear_rookies
    auth.ts                       # NextAuth config
    story_audit.ts
    story_markup.ts
    tools.ts
    f1/
      db.ts                       # F1 DB tables
      mr_bear.ts                  # Mr. Bear predictions (pure TS, no LLM)
      jolpica.ts                  # Jolpica F1 API client
      adapter.ts / cache.ts / types.ts
      __tests__/
  proxy.ts                        # Route protection middleware
mr_bear/                          # Standalone data/scripts
data/                             # Local SQLite (gitignored)
```

## Public Routes
Per `src/proxy.ts`:
- Pages: `/login`, `/story/*`, `/archive`, `/creative/archive`, `/games/*`, `/weather`, `/privacy`, `/terms`
- API: `/api/auth/*`, `/api/health`, `/api/stories`, `/api/prompts`, `/api/oura/*`

## Database Schema
**Main DB:** `posts`, `archive_info`, `stories`, `story_audits`, `mr_bear_rookies`, `substack_titles`
**F1 DB:** `f1_seasons`, `f1_sessions`, `f1_drivers`, `f1_predictions`, `f1_scores`, `f1_player_state`, `f1_cancelled_rounds`

Both DBs use same Turso connection in production, same `data/posts.db` locally.
Schema auto-initializes. Inline `ALTER TABLE` migrations use catch-and-ignore pattern.

`strava_tokens`, `strava_athlete_cache`, `strava_activities_cache` are orphaned — left over from the retired Strava integration (replaced by Ride with GPS). No code references them; intentionally not dropped (no DROP-table migration pattern exists in this codebase).

## Authentication
- GitHub OAuth: whitelist via `ALLOWED_GITHUB_USERS` (matches `profile.login`)
- Guest PIN: `GUEST_PINS=pin1,pin2` env var
- JWT strategy, 30-day session maxAge

## Environment Variables
```
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
ALLOWED_GITHUB_USERS=boneshakerbike
GUEST_PINS=
NEXTAUTH_SECRET=
ANTHROPIC_API_KEY=
OURA_CLIENT_ID=
OURA_CLIENT_SECRET=
RIDEWITHGPS_API_KEY=      # Basic Auth to ridewithgps.com/api/v1/trips.json —
RIDEWITHGPS_AUTH_TOKEN=   # static, non-expiring, generated once on the RWGPS dashboard
```

## Model IDs

All model IDs are centralised in `src/lib/models.ts`. Import `MODELS` from there — do not hardcode model strings in route files. Update that file when upgrading models.

## Code Conventions
- `snake_case` for backend/lib functions and variables
- `camelCase` in React components
- `PascalCase` for types
- `'use client'` required for interactive components
- Page titles: `document.title = '8i11 | Page Name'` in `useEffect`
- Path alias: `@/*` → `./src/*`

## Key Architectural Notes
**NavTabs:** Radix UI DropdownMenu. Trigger buttons need `bg-transparent outline-none focus:outline-none focus-visible:outline-none`. Chevron uses `group-data-[state=open]:rotate-180`.

**Database detection:** `is_turso = !!process.env.TURSO_DATABASE_URL`

**Oura Ring:** Standalone OAuth. Tokens in `oura_tokens` table (singleton). 13 endpoints + personal_info. Daily caching via `wellness_cache`. Activity time fields in **seconds**.

**Ride with GPS:** Replaced Strava (Strava moved to a subscriber-only API tier). Basic Auth via two static headers (`x-rwgps-api-key`, `x-rwgps-auth-token`) — no OAuth, no token refresh, no DB storage; `/api/ridewithgps/data` is protected only by `proxy.ts`'s default session gate (no exemption needed, unlike Strava/Oura/COROS which needed one for their OAuth callbacks or out-of-session tooling). No DB cache either — relies on Next's `fetch` `revalidate: 300` for brief resilience, trading away the "serve last-known-good on API failure" behavior Strava had for simplicity. `trips.json` has no date-range filter, so "yesterday's activities" is done by fetching a page and filtering client/server-side on `departed_at` via `rwgps_activity_date_str()` in `src/lib/ridewithgps.ts`. The offset-suffixed branch (e.g. `-06:00`) is confirmed correct against live data. Also confirmed against live data: `trips.json`'s list response never populates `web_url` despite the OpenAPI schema documenting it — `trip_to_activity()` constructs `https://ridewithgps.com/trips/{id}` instead. Still unconfirmed: whether `trips.json` reliably sorts newest-first (no documented `sort` param) — verify before trusting "yesterday" classification if activity volume grows enough that 30 trips might not cover a day.

**COROS:** `/health/coros` is session-gated by `proxy.ts` — in-browser saves (e.g. the page's Manual Input form) ride the NextAuth cookie, so `X-Guest-Pin` is only needed for out-of-session callers (curl, the Chrome-extension prompt). Display logic supports two JSON shapes and falls back between them: standard (`report_markdown`, `dashboard.training_status.status`, `dashboard.recovery.percentage`) and nested/alt (`markdown`, `data.training_status_dashboard.status`, `data.recovery.percent`). If a save looks like it "worked" but the page renders blank, query `/api/coros/data?date=YYYY-MM-DD` directly first to confirm what actually landed in Turso before assuming the write failed.

**F1 / Mr. Bear:** Pure TypeScript, no LLM. Rankings from last 3 race weekends qualifying averaged. Rookies via `mr_bear_rookies` DB table.

**Story generation:** Claude with ephemeral prompt caching. Every source post linked exactly once. ~$0.17/story with Opus.

**Story audit:** `src/lib/story_audit.ts` is a pure, tested function scanning each source post's `content_html`; results are stored in `story_audits` and rendered by the edit page's audit sidebar. Content flags alongside the structural ones: `broken_markup` (WordPress shortcodes, `<!-- wp: -->` block comments, or entity-escaped tags left as plain text — image-bearing shortcodes like `[gallery]`/`[caption]` also say so when the post has no `<img>`), `missing_images` (references to hosts in `DEAD_IMAGE_HOSTS`, currently Imgur — dead Imgur URLs still return 200 with a placeholder, so liveness can't be probed and the host itself is the signal), and `post_too_short` (≤ `SHORT_POST_SENTENCE_LIMIT` sentences; block tags count as sentence breaks and leaked shortcodes are excluded from the count). Old stored audits predate these flags — re-run the audit to pick them up; the sidebar's type breakdown is derived client-side so old records still render.

**Substack titles:** `/api/clean-text` mode `substack` returns a headline title/subtitle plus six alternates. Anti-formula logic lives in `src/lib/substack_titles.ts` (pure, tested): a banned-template list of overdone title shapes, near-duplicate detection (≥60% content-word overlap), output parsing, and rotating "angles" injected per request for variety. Titles are deduped against both `substack_titles` (everything the tool has offered, including unpicked alternates) and the `posts` archive (real published titles). Offending titles trigger one corrective retry that keeps the narrative intact. All history reads/writes are best-effort — a DB failure degrades to a normal generation rather than losing the story. Note: because unpicked alternates are recorded, regenerating the same story cannot return a title from a previous run.

**Say What? → Knowledge doc:** the Knowledge button posts `mode: 'knowledge'` to `/api/clean-text`, which distils the input into a Markdown knowledge document opening with a single `# Subject` heading. The route has no web access, so the prompt does not claim to fact-check: it records only what the input supports, names contradictions, and parks anything uncertain under a closing `## Unverified` section. `src/lib/knowledge_doc.ts` (pure, tested) derives the subject from that heading and the `Subject_Name.md` download filename from the subject. Download is a Blob object URL, not a `data:` URL, so long documents aren't capped by URL length. Text only for now — the page's photo picker lives inside the Story Version pane and isn't reachable before generating, so wiring images into this path is a separate change (#274). Saving to Google Drive is #268, deferred.

**Say What? → GitHub:** the cleaned-text pane's GitHub button opens GitHub's own new-issue form in a new tab with the title and body prefilled — no token, no API route, no env var, and nothing is filed until Bill submits GitHub's form. URL construction is in `src/lib/github_issue.ts` (pure, tested): title from the first sentence or line (word-boundary truncation at 70 chars), and a 6000-char cap on the whole URL because GitHub answers 414 long before browsers stop sending. An oversized body is truncated in the URL and the full text goes to the clipboard instead — that clipboard write is deliberately not awaited so `window.open` still runs inside the click gesture, or mobile Safari's popup blocker eats it. A token-backed one-click version (POST to our own route, PAT in a Vercel env var) was costed and deferred: it trades away the review-before-submit step and adds PAT rotation. If it's ever picked up, the preferred shape is an in-app modal with editable title/body, and note that guest-PIN sessions would be able to file issues under Bill's GitHub identity.

**Uploads:** 4.5MB Vercel limit. Client batches posts (500/req) and HTML (50/req).

**Timezone:** Client sends local date. Posts stored in Mountain Time (America/Denver). Vercel runs UTC.

**Wellness coaching:** Bill has existing prompts and SoKs. Do NOT build LLM coaching features without checking first.

## Development Workflow

### Branching
- All work happens on `work/<shortname>-<topic>` branches. Never commit to main.
- Bill's shortname: `bill`. Agents pick their own.

### After Completing Work
1. Commit and push to the working branch
2. `npm run build` and `npm run lint` must pass before opening a PR
3. Open a PR to main
4. Provide: Vercel preview link, what to test, expected results

### PR Hygiene
- Commit messages: short imperative sentence, no body unless the why isn't obvious
- All commits must be followed by `git push` to origin before considering a task complete

## Task Management
GitHub Issues: https://github.com/boneshakerbike/onthisday/issues
