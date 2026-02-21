# AGENTS.md -- 8i11 Agent Boot Protocol

This is the boot doc for any agent working on this repo (Chip, Hex, Codex, or other).
Read this before starting work. Keep it current. No separate WELCOME.md needed.

---

## 0. New Machine / New Agent Setup

Checklist for getting a new machine or agent operational:

1. **Clone the repo**
   ```bash
   git clone https://github.com/boneshakerbike/onthisday.git
   cd onthisday
   ```
2. **Read this file**, then `CLAUDE.md` for project knowledge
3. **Get credentials from Bill:**
   - `X-Guest-Pin` for Chipboard write operations
   - `WORKLOG_API_KEY` for worklog write operations
4. **Store WORKLOG_API_KEY as an env var** (never in code or conversation):
   - Windows: `setx WORKLOG_API_KEY "key"` (in a separate terminal)
   - Linux: add `export WORKLOG_API_KEY="key"` to `~/.profile`
   - Linux: run `sed -i 's/\r$//' ~/.profile` if key was piped from Windows
5. **Verify network access:**
   ```bash
   curl -s https://8i11.vercel.app/api/worklog?limit=1
   curl -s https://8i11.vercel.app/api/suggestions?status=inbox&public=true
   ```
6. **Verify worklog write access** (POST should return 200)
7. **Run the Boot Sequence** (section 1) once to confirm end-to-end

---

## 1. Boot Sequence

On every session start:

```bash
# 1. Read last 3 worklog entries (what happened while you were away)
curl -s "https://8i11.vercel.app/api/worklog?limit=3"

# 2. Check tasks by status (replace TAG with chip/hex/codex)
curl -s "https://8i11.vercel.app/api/suggestions?status=inbox&tag=TAG"
curl -s "https://8i11.vercel.app/api/suggestions?status=todo&tag=TAG"
curl -s "https://8i11.vercel.app/api/suggestions?status=inwork&tag=TAG"

# Or check all non-resolved items (inbox + todo + inwork)
curl -s "https://8i11.vercel.app/api/suggestions?status=inbox"
curl -s "https://8i11.vercel.app/api/suggestions?status=todo"
curl -s "https://8i11.vercel.app/api/suggestions?status=inwork"

# Public read (no auth required) -- for fresh environments
curl -s "https://8i11.vercel.app/api/suggestions?status=inbox&public=true"
```

Summarize what changed while you were away and ask Bill for clarifications on any
items you're assigned.

Chipboard is the single source of truth for tasks and context. No local state files.
If Chipboard is down, the app is down -- same operational risk, nothing new.

---

## 2. Chipboard Fields

| Field | Purpose |
|-------|---------|
| `id` | Stable item ID |
| `slug` | Human-readable ID (defaults to `id` for existing items) |
| `status` | `inbox` / `todo` / `inwork` / `done` / `rejected` |
| `tags` | Comma-separated string, e.g. `"chip,feature,high"`. Categories: ownership (`chip`, `hex`, `codex`), priority (`high`, `low`), type (`feature`, `bug`, `research`) |
| `assigned_to` | Agent currently working this item. Null = available. |
| `blocked_reason` | Why work is stalled. Null = not blocked. |
| `context` | Append-only log of agent notes and decisions |
| `last_context_at` | ISO timestamp of last context write. Drives 48h claim expiry. |

---

## 3. Claiming and Releasing Work

**Claim an item** before starting work:
```bash
curl -X PATCH https://8i11.vercel.app/api/suggestions \
  -H "Content-Type: application/json" \
  -H "X-Guest-Pin: YOUR_PIN" \
  -d '{"id": "ITEM_ID", "assigned_to": "chip"}'
```

**Release an item** when done or blocked:
```bash
curl -X PATCH https://8i11.vercel.app/api/suggestions \
  -H "Content-Type: application/json" \
  -H "X-Guest-Pin: YOUR_PIN" \
  -d '{"id": "ITEM_ID", "assigned_to": null}'
```

**Stale claim expiry:** Items assigned but with `last_context_at` older than 48 hours are
auto-unassigned on every GET request. Active work resets the timer automatically via
`context_append`.

---

## 4. Appending Context

Context is append-only. Never overwrite. Use `[CORRECTION]` prefix to correct prior entries.

```bash
curl -X POST https://8i11.vercel.app/api/suggestions/context_append \
  -H "Content-Type: application/json" \
  -H "X-Guest-Pin: YOUR_PIN" \
  -d '{"id": "ITEM_ID", "agent": "chip", "entry": "Your note here"}'
```

Each entry is stored as `[agent | ISO_timestamp]\nentry`. Entries are separated by blank lines.

---

## 5. Operational Policy

- **No secrets in Chipboard items.** No tokens, PINs, API keys, or credentials -- ever.
- **Context is append-only.** Use `[CORRECTION]` entries to fix wrong information.
- **Only mark items done when fully complete.** Partial work gets a new item for the remainder.
- **Don't delete items.** Mark as `rejected` or `done`. Deletion breaks slug references.
- **Push code when shipping features.** Context lives in Chipboard -- no push needed for context-only updates.

---

## 6. Session End Protocol

On every session end, POST one worklog entry:

```bash
curl -X POST https://8i11.vercel.app/api/worklog \
  -H "Content-Type: application/json" \
  -H "X-Worklog-Key: $(powershell -Command \"[System.Environment]::GetEnvironmentVariable('WORKLOG_API_KEY', 'User')\")" \
  -d '{
    "agent_id": "YOUR_AGENT",
    "machine_id": "YOUR_MACHINE",
    "session_id": "UUID_FROM_BOOT",
    "summary": "Did: ...\nChanged: ...\nOpen: ...\nNeed: ...",
    "tasks_touched": ["id1", "id2"],
    "status": "info",
    "tags": []
  }'
```

Status values: `info` (normal), `warning` (something needs attention), `blocked` (cannot proceed), `done` (project milestone complete).

Write only on session end. Not mid-session.

If POST fails with 401/400 on penguin, check for CRLF in `~/.profile` and normalize
line endings: `sed -i 's/\r$//' ~/.profile && source ~/.profile`

---

## 7. Truth Hierarchy

1. **Chipboard task state** = authoritative
2. **Worklog** = authoritative for agent activity
3. **Local memory** = advisory only (preferences/config, never tasks)

**No-stale rule:** If task status in memory conflicts with Chipboard, Chipboard wins.
Memory never overwrites Chipboard state.

---

## 8. Agent Roles

| Agent | Machine | Lane |
|-------|---------|------|
| **Chip** | penguin (Chromebook) | Implementation, deploys, architecture. Owns Chipboard triage. |
| **Hex** | della (Windows PC) | Research, drafts, analysis, implementation. Has git push access to GitHub. |
| **Codex** | della (Windows PC) | Security audits, system design, independent review. |

Team protocol: **propose -> discuss -> agree -> act.** Do not skip agree.

---

## 9. Key API Endpoints

```
GET  /api/suggestions?status=pending              # All pending -- public endpoint, full payload
GET  /api/suggestions?status=pending&public=true  # Filtered fields only (id/slug/status/tags/assigned_to/blocked_reason/context_preview)
GET  /api/suggestions?tag=chip                    # Filter by agent tag
POST /api/suggestions                             # Create item (auth required)
PATCH /api/suggestions                            # Update status/tags/assigned_to/blocked_reason (auth required)
POST /api/suggestions/context_append              # Append context entry (auth required)
GET  /api/worklog?limit=3                         # Recent worklog entries -- public
GET  /api/worklog?agent_id=hex                    # Filter by agent -- public
POST /api/worklog                                 # Write worklog entry (X-Worklog-Key required)
```

Auth for Chipboard: session cookie (browser) or `X-Guest-Pin` header (CLI/agents).
Auth for Worklog: `X-Worklog-Key` header only. No guest PIN fallback.

Note: GET endpoints for suggestions and worklog are intentionally public. This is safe
because Chipboard items must never contain secrets (policy). The Chipboard web UI at
/tools/chipboard is auth-protected -- only the raw API endpoints are open.

---

## 10. Disaster Recovery

If local environment is lost:
1. Clone the repo from GitHub
2. Check Chipboard for current tasks and context
3. Read `AGENTS.md` (this file) and `CLAUDE.md` for project knowledge
4. Resume -- no local state needed

Chipboard + GitHub repo = complete recoverable state.
