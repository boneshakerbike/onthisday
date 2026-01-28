# CLAUDE.md - On This Day

## Project Overview

**On This Day** is a Next.js web application that allows users to discover Substack posts published on any given date across multiple years. It serves as a personal archive explorer with AI-powered "looking back" reflections using the Claude API.

### Key Features
- Browse posts by month/day across all archived years
- Upload and manage Substack archives (via ZIP export)
- Auto-sync latest posts from RSS feed
- AI-powered story generation for historical reflection
- **Shareable story pages** at `/story/[id]` (public, no auth required)
- GitHub OAuth and guest PIN authentication
- Copy posts to clipboard for Substack publication

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16.1.4 with App Router |
| Language | TypeScript 5.x |
| UI | React 19.2.3 + Tailwind CSS 4.x |
| Database | Turso (libSQL) production / SQLite (better-sqlite3) local |
| Auth | NextAuth.js 4.24.13 (GitHub OAuth + Guest PIN) |
| AI | Anthropic Claude SDK (@anthropic-ai/sdk) |
| Processing | jszip (ZIP), papaparse (CSV) |

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Main dashboard (client component)
│   ├── layout.tsx                # Root layout with session provider
│   ├── globals.css               # Global Tailwind CSS
│   ├── login/page.tsx            # Login page with OAuth & PIN auth
│   ├── story/[id]/
│   │   ├── page.tsx              # Public shareable story page
│   │   └── share_button.tsx      # Client-side share component
│   └── api/
│       ├── posts/route.ts        # GET: fetch posts by date
│       ├── upload/route.ts       # POST: batch upload archives
│       ├── generate/route.ts     # POST: AI story generation
│       ├── story/route.ts        # GET: fetch story by date
│       ├── sync/route.ts         # GET: RSS feed sync
│       ├── health/route.ts       # GET/POST: health check & cleanup
│       ├── config/route.ts       # GET: configuration status
│       └── auth/[...nextauth]/   # NextAuth handler
├── components/
│   └── session_provider.tsx      # NextAuth SessionProvider wrapper
├── lib/
│   ├── db.ts                     # Database abstraction & queries
│   └── auth.ts                   # NextAuth configuration
└── middleware.ts                 # Route protection middleware
```

## Database Schema

Located in `src/lib/db.ts`:

```sql
-- Posts table
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT UNIQUE NOT NULL,    -- Substack post slug
  title TEXT NOT NULL,
  subtitle TEXT,
  post_date TEXT NOT NULL,         -- UTC publication date
  local_date TEXT NOT NULL,        -- Mountain Time (America/Denver)
  audience TEXT,
  type TEXT,
  content_html TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for date queries
CREATE INDEX idx_posts_local_date ON posts(local_date);
CREATE INDEX idx_posts_month_day ON posts(substr(local_date,6,2), substr(local_date,9,2));

-- Archive metadata (singleton)
CREATE TABLE archive_info (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  filename TEXT,
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Generated stories (one per date)
CREATE TABLE stories (
  id TEXT PRIMARY KEY,              -- 8-char random ID for shareable URLs
  date_key TEXT NOT NULL,           -- MM-DD format
  date_display TEXT NOT NULL,       -- "January 28" format
  content TEXT NOT NULL,            -- Generated HTML
  post_count INTEGER NOT NULL,
  image_url TEXT,                   -- First image from source posts
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_stories_date_key ON stories(date_key);
```

**Key Details:**
- Dates stored in YYYY-MM-DD format
- Uses Mountain Time (America/Denver) for date consistency
- Post IDs are unique to prevent duplicates during sync

## API Endpoints

All endpoints protected by NextAuth middleware except `/api/auth/*`, `/api/health`, and `/story/*`.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/posts?date=M-D` | GET | Fetch posts for a specific month/day across years |
| `/api/upload` | POST | Batch-upload Substack archive (clear, posts_batch, html_batch) |
| `/api/generate` | POST | Generate AI story using Claude (`claude-sonnet-4-20250514`) |
| `/api/story?date=MM-DD` | GET | Fetch existing story for a date |
| `/api/sync` | GET | Fetch RSS feed and add missing posts |
| `/api/health` | GET | Database health check (posts + stories stats) |
| `/api/health?action=cleanup_stories` | POST | Remove duplicate stories, keep most recent per date |
| `/api/config` | GET | Check if Claude API key is configured |
| `/story/[id]` | GET | **Public** shareable story page (no auth required) |

### Upload Batch Types
- `clear` - Clear all posts and update archive metadata
- `posts_batch` - Append posts from CSV (~500 per request)
- `html_batch` - Update HTML content for posts (~50 files per request)

## Authentication

Dual authentication system via NextAuth.js:

1. **GitHub OAuth** - Standard OAuth2 flow
2. **Guest PIN** - Credentials-based, PIN compared against `GUEST_PIN` env var

**Session:** JWT strategy with 30-day maxAge

**Protected Routes:** All except `/login`, `/story/*`, `/api/auth/*`, `/api/health`

## Development Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Environment Variables

### Production Database (Turso)
```
TURSO_DATABASE_URL=<libSQL connection URL>
TURSO_AUTH_TOKEN=<auth token>
```

### Authentication
```
GITHUB_CLIENT_ID=<OAuth app ID>
GITHUB_CLIENT_SECRET=<OAuth app secret>
GUEST_PIN=<numeric PIN for guest access>
NEXTAUTH_SECRET=<session encryption secret>
```

### AI Features
```
ANTHROPIC_API_KEY=<Claude API key>
```

### Local Development
- No env setup needed (uses local SQLite in `/data` directory)
- Optional: Set env vars for OAuth testing

## Code Conventions

### Naming
- **Functions:** snake_case (e.g., `get_posts_on_date`, `fetch_posts`)
- **Types/Interfaces:** PascalCase (e.g., `Post`, `PostWithMeta`)
- **Variables:** snake_case in backend, camelCase in React components

### Database Patterns
- Singleton client instance per environment
- Lazy-loaded schema initialization
- UTC to Mountain Time conversion for all dates

### API Patterns
- Try-catch with JSON error responses
- Batch processing for large uploads (Vercel payload limits)
- Type-safe request/response definitions

### React Patterns
- `'use client'` directive for interactive components
- `useSession()` from NextAuth for user context
- Promise-based fetch with error handling

## Key Data Flows

### Archive Upload
1. Client extracts ZIP (jszip) and parses posts.csv (papaparse)
2. POST `/api/upload` with `batch_type: 'clear'`
3. POST multiple `posts_batch` requests (~500 posts each)
4. POST multiple `html_batch` requests (~50 files each)
5. Frontend refreshes posts for current date

### RSS Sync
1. Frontend calls GET `/api/sync` on page load
2. Backend fetches RSS from `https://8i11.substack.com/feed`
3. Adds missing posts with `insert or ignore`
4. If new posts added, frontend auto-refreshes

### Story Generation
1. POST `/api/generate` with `{ month, day }`
2. Backend fetches posts and calls Claude with cached system prompt
3. Extracts first image from source posts for visual flair
4. Saves story to database (one per date, updates if exists)
5. Returns HTML story, story_id, token usage metrics
6. Story page at `/story/[id]` is public and shareable

## Important Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/app/page.tsx` | ~750 | Main dashboard with all UI logic |
| `src/lib/db.ts` | ~520 | Database abstraction layer (posts + stories) |
| `src/app/api/generate/route.ts` | ~180 | Claude AI integration + story saving |
| `src/app/story/[id]/page.tsx` | ~210 | Public shareable story page |
| `src/app/login/page.tsx` | ~191 | Authentication UI |
| `src/middleware.ts` | - | Route protection |

## Notes for AI Assistants

1. **Database Environment:** Code auto-detects Turso vs local SQLite based on `TURSO_DATABASE_URL` presence

2. **Timezone Handling:** All dates use Mountain Time (America/Denver). The client sends its local date, and the server stores `local_date` accordingly

3. **Batch Uploads:** Large uploads are split client-side to stay under Vercel's 4.5MB payload limit

4. **Prompt Caching:** Claude system prompt uses Anthropic's ephemeral cache for cost optimization

5. **RSS Feed:** The Substack RSS URL is hardcoded to `https://8i11.substack.com/feed`

6. **Protected vs Public Routes:**
   - Public: `/login`, `/story/*`, `/api/auth/*`, `/api/health`
   - Protected: Everything else (requires authentication)

7. **Local Data Directory:** The `/data` directory (containing SQLite DB) is gitignored

8. **Path Alias:** Use `@/*` to reference `./src/*` paths

9. **No Tests:** This project currently has no test suite

10. **Single User Focus:** Designed for a single Substack newsletter archive, not multi-tenant
