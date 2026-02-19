# AGENTS.md — 8i11 Agent Boot Protocol

Canonical boot sequence for any agent working on this repo (Chip, Hex, Codex, or other).
Read this before starting work. Keep it current.

---

## 0. Getting Started (Fresh Machine)

```bash
# Clone the repo
git clone https://github.com/boneshakerbike/onthisday.git
cd onthisday

# Read this file, then CLAUDE.md for project knowledge
```

**PIN:** Write operations require `X-Guest-Pin`. If `.env.local` isn't available, ask Bill for the PIN.

---

## 1. Boot Sequence

On every session start:

```bash
# Check pending tasks assigned to you (replace TAG with chip/hex/codex)
curl -s "https://8i11.vercel.app/api/suggestions?status=pending&tag=TAG"

# Or check all pending
curl -s "https://8i11.vercel.app/api/suggestions?status=pending"

# Public read (no auth required) — for fresh environments
curl -s "https://8i11.vercel.app/api/suggestions?status=pending&public=true"
```

Chipboard is the single source of truth for tasks and context. No local state files.
If Chipboard is down, the app is down — same operational risk, nothing new.

---

## 2. Chipboard Fields

| Field | Purpose |
|-------|---------|
| `id` | Stable item ID |
| `slug` | Human-readable ID (defaults to `id` for existing items) |
| `status` | `pending` / `considering` / `done` / `rejected` |
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

- **No secrets in Chipboard items.** No tokens, PINs, API keys, or credentials — ever.
- **Context is append-only.** Use `[CORRECTION]` entries to fix wrong information.
- **Only mark items done when fully complete.** Partial work gets a new item for the remainder.
- **Don't delete items.** Mark as `rejected` or `done`. Deletion breaks slug references.
- **Push code when shipping features.** Context lives in Chipboard — no push needed for context-only updates.

---

## 6. Agent Roles

| Agent | Machine | Lane |
|-------|---------|------|
| **Chip** | penguin (Chromebook) | Implementation, deploys, architecture. Owns Chipboard triage. |
| **Hex** | della (Windows PC) | Research, drafts, analysis. Writes to `shared-workspace/`. Does not push code. |
| **Codex** | della (Windows PC) | Security audits, system design, independent review. |

Team protocol: **propose → discuss → agree → act.** Do not skip agree.

---

## 7. Key API Endpoints

```
GET  /api/suggestions?status=pending              # All pending — public endpoint, full payload
GET  /api/suggestions?status=pending&public=true  # Filtered fields only (id/slug/status/tags/assigned_to/blocked_reason/context_preview)
GET  /api/suggestions?tag=chip                    # Filter by agent tag
POST /api/suggestions                             # Create item (auth required)
PATCH /api/suggestions                            # Update status/tags/assigned_to/blocked_reason (auth required)
POST /api/suggestions/context_append              # Append context entry (auth required)
```

Auth: session cookie (browser) or `X-Guest-Pin` header (CLI/agents).
Note: GET /api/suggestions is intentionally public and returns full payload. This is safe
because Chipboard items must never contain secrets (policy). The Chipboard web UI at
/tools/chipboard is auth-protected — only the raw API endpoint is open.

---

## 8. Disaster Recovery

If local environment is lost:
1. Clone the repo from GitHub
2. Check Chipboard for current tasks and context
3. Read `AGENTS.md` (this file) and `CLAUDE.md` for project knowledge
4. Resume — no local state needed

Chipboard + GitHub repo = complete recoverable state.
