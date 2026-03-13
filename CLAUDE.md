# 8i11 — onthisday-next

**Live:** https://8i11.vercel.app | **Repo:** https://github.com/boneshakerbike/onthisday

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

## Development Commands
```bash
npm run dev      # Start dev server on :3000
npm run build    # Build for production
npm run lint     # ESLint
npx vitest       # Run tests (src/lib/f1/__tests__/)
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
    story/[id]/page.tsx           # Shareable story page (public)
    tools/
      markdown/                   # Rich text → Markdown converter
      knowledge-diff/             # Compare knowledge docs
      prompt-library/             # Versioned prompt storage with AI review
      text-cleaner/               # Text cleaning + story builder
      instruction-stripper/       # Strip instructions from text
      admin/                      # Admin reference
    health/
      wellness/page.tsx           # Oura Ring wellness dashboard
    games/
      f1/page.tsx                 # F1 Predictors Championship
      frogger/                    # Pixel art frogger
      breakout/                   # Brick breaker
    weather/page.tsx              # Weather (public)
    login/ privacy/ terms/
    archive/                      # Redirects to /creative/archive
    stories/                      # Redirects to /creative/archive
    tools/wellness/               # Redirects to /health/wellness
    api/
      posts/ upload/ generate/
      sync/ story/ stories/
      intro/ clean-text/ strip/
      knowledge-diff/
      prompts/ prompts/review/
      oura/                       # OAuth: authorize callback data sync disconnect
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
**Main DB:** `posts`, `archive_info`, `stories`, `story_audits`, `mr_bear_rookies`
**F1 DB:** `f1_seasons`, `f1_sessions`, `f1_drivers`, `f1_predictions`, `f1_scores`, `f1_player_state`, `f1_cancelled_rounds`

Both DBs use same Turso connection in production, same `data/posts.db` locally.
Schema auto-initializes. Inline `ALTER TABLE` migrations use catch-and-ignore pattern.

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

**F1 / Mr. Bear:** Pure TypeScript, no LLM. Rankings from last 3 race weekends qualifying averaged. Rookies via `mr_bear_rookies` DB table.

**Story generation:** Claude with ephemeral prompt caching. Every source post linked exactly once. ~$0.17/story with Opus.

**Uploads:** 4.5MB Vercel limit. Client batches posts (500/req) and HTML (50/req).

**Timezone:** Client sends local date. Posts stored in Mountain Time (America/Denver). Vercel runs UTC.

**Wellness coaching:** Bill has existing prompts and SoKs. Do NOT build LLM coaching features without checking first.

## Branching & Deployment
```
work/<shortname>-<topic>  →  PR to main  →  Vercel auto-deploy
```
- Never commit directly to main
- Never include `Closes #N` / `Fixes #N` / `Resolves #N` in commits or PRs
- Bill authorizes merge of PRs to main
- Bill closes issues himself after testing

## Task Management
GitHub Issues: https://github.com/boneshakerbike/onthisday/issues
