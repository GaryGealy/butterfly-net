# Digital Assistant (butterfly-net) — Design Spec

## Overview

A digital replacement for the piles of 3×5 cards on my desk. Each card is one
thing I don't want to forget — mostly someday-actions with no deadline. Each pile
is a category. When a card's done, it gets tossed.

The problem is capture, not scheduling: thoughts are like butterflies — if you
don't catch them, they flutter away. So the design optimizes for one motion:
type a line, and it lands on the right pile. Claude does the sorting; I confirm.

It is also a learning project. The stack deliberately reuses what I know from
DealOps (SvelteKit, Cloudflare) so the new learning concentrates on the Claude
API: prompting, structured output, and failure handling.

This idea supersedes `random-thoughts` (killed 2026-09-30).

## Product Identity

- **Type:** Cloud web app, installable as a PWA on desktop and phone
- **Users:** Me first; multi-user from day one (email/password), so others could use it
- **Core loop:** capture a card → Claude proposes its pile → confirm → card sits on
  its pile → mark done → archived
- **What Claude does:** reads one line of text and fills in the card — title,
  pile (existing or a proposed new one), and any notes or subtasks the text
  clearly contains. Nothing else in v1.

## v1 Scope

### In

- **Capture** from two places: the main app and a bare `/quick-add` page
- **Parse & categorize** by Claude, shown as a **preview**; nothing saves until I confirm
- **Piles** (categories), seeded with: house, work stuff, ideas, video games,
  model building. Claude may propose a new pile; it's created only if I accept it
- **Cards:** one-line title, optional notes body, optional subtask checklist
- **Main view grouped by pile**
- **Done → archive:** leaves the pile, stays searchable, can be reopened
- **Full-text search** across active and archived cards
- **Email/password auth**, every query scoped to the user

### Out (v1)

Due dates, reminders and notifications, priority, recurring cards, voice input
and output, offline capture, integrations (calendar, idea-forge), export,
"thought of the day" resurfacing.

### Later list

JSON export; "thought of the day" resurfacing; voice capture (Web Speech API is
the first candidate); optional due dates if their absence is missed.

## Tech Stack

Mirrors DealOps:

- **Frontend:** SvelteKit + Svelte 5, TypeScript, Tailwind CSS 4
- **Backend:** SvelteKit server routes, Drizzle ORM, Zod validation
- **Database:** Cloudflare D1 (SQLite locally), with FTS5 for full-text search
- **Hosting:** Cloudflare Pages
- **Auth:** email/password, session-based (PBKDF2 via Web Crypto) — the DealOps pattern
- **LLM:** Claude API via the official `@anthropic-ai/sdk`, server-side only; API
  key in a Cloudflare secret
- **Testing:** Vitest (unit), Playwright (E2E)

### Hotkey capture without a desktop app

A web page can't register a system-wide hotkey. Instead:

- The app is installable as a PWA (own window, Dock icon, Spotlight-launchable)
- A macOS **Shortcuts** shortcut bound to a key combo opens `/quick-add`
- Inside the app, `N` focuses the capture box

## Architecture

One SvelteKit app on Cloudflare Pages.

| Layer | Responsibility |
|---|---|
| Pages (Svelte) | `/`, `/quick-add`, `/card/[id]`, `/search`, `/archive`, `/piles`, auth pages |
| Server routes | Card/pile/subtask CRUD, `POST /api/parse`, search |
| D1 | users, sessions, piles, cards, subtasks, `cards_fts` |
| Claude API | Called only from `/api/parse` |

### Data model

- **users** — id, email, password_hash, created_at
- **sessions** — DealOps pattern
- **piles** — id, user_id, name, sort_order, created_at. The five default piles
  are created at signup. `(user_id, name)` is unique
- **cards** — id, user_id, pile_id, title, notes (nullable), status
  (`active` | `done`), created_at, done_at (nullable)
- **subtasks** — id, card_id, text, done, sort_order
- **cards_fts** — FTS5 virtual table over card title, notes, and concatenated
  subtask text; kept in sync on every card or subtask write

Every read and write is scoped by `user_id`. Marking done sets `status = done`
and `done_at`; reopening clears both.

Note: D1 export does not support virtual tables. Backups must drop and recreate
`cards_fts` around an export (it is derived data and can be rebuilt).

## Capture Flow

1. I type one line and press Enter.
2. Browser → `POST /api/parse` with `{ text }`. The server loads my pile names.
3. Server calls Claude with a structured-output JSON schema:
   ```
   { title: string, pile: string, isNewPile: boolean,
     notes: string | null, subtasks: string[] }
   ```
   - `title` — tidied phrasing of what I typed
   - `pile` — an existing pile name, or a proposed new one with `isNewPile: true`
   - `notes` / `subtasks` — only when the text clearly contains them
4. **Preview** renders the card: title, a pile dropdown preselected to Claude's
   choice (a new pile shows as "New pile: <name>", acceptable or swappable), and
   any notes or subtasks.
5. Enter (or Save) writes the card. Anything can be edited first.

The server validates Claude's response with Zod: if `isNewPile` is false but
`pile` isn't one of mine, treat it as a proposed new pile.

### Claude call

- **Model:** `claude-opus-5-5` at `effort: low` — a small classification task.
  Moving to Sonnet 5.5 or Haiku 4.5 for latency or cost is a one-line config
  change; decide from measurement, not in advance.
- **Prompt:** fixed system instructions plus my pile list (stable prefix, cache-
  friendly); the typed text is the user message.
- **Structured outputs** via `output_config.format` (SDK `messages.parse`).
- **Refusal fallback:** server-side `fallbacks: "default"` enabled; check
  `stop_reason` before reading content.
- Verify exact SDK call shapes against current docs at implementation time.

### Failure handling — never lose a butterfly

- **Claude error, refusal, or timeout (~5 s):** the preview still appears with
  my raw text as the title and no pile selected. I pick one and save. Capture
  never depends on Claude.
- **Network failure on save:** the text stays in the box with a retry prompt.
  No offline queue in v1.
- **Invalid schema output:** same as a Claude error — fall back to raw text.

## Screens

- **`/` Piles** — capture box on top; each pile a section with a card count.
  Click a card to open it; checkbox marks done with an Undo toast.
- **`/card/[id]`** — edit title, notes, subtasks; change pile; done; delete.
- **`/quick-add`** — capture box and preview only. After save: clears, shows
  "Caught ✓", ready for the next.
- **`/search`** — one box; results span active and archived, archived labeled.
- **`/archive`** — done cards, newest first; reopen any.
- **`/piles`** — rename, reorder, delete. Deleting a non-empty pile asks where
  its cards go.
- **Auth** — sign up, log in, log out.
- **PWA** — manifest and icons; phone-friendly layout from the start.

## Testing

TDD throughout.

- **Vitest (unit):**
  - `/api/parse` with Claude mocked: valid result, proposed new pile, unknown
    pile coerced to new, API error, timeout, refusal, schema-invalid output
  - Card, pile and subtask logic, including done/reopen and pile deletion with
    card reassignment
  - Search, including archived results
  - User scoping: no query returns another user's data
- **Playwright (E2E):** sign up → capture → confirm preview → card on pile →
  mark done → find it via search in the archive. Plus: Claude unavailable →
  card still saved.
- **Live smoke check (manual, not CI):** ~15 real cards from my piles through
  the real API to judge sorting quality.

## Deployment

- New build repo at `~/repos/company-of-one/butterfly-net` (record it in the
  idea's `Repo` field once it has code).
- CI runs tests on every push.
- Production deploy to Cloudflare Pages fires **only** on a pushed `v*` tag.
- D1 schema changes via Drizzle migrations.

## Success Criteria

- I use it instead of 3×5 cards for 30 days
- Claude's pile choice is right often enough that I rarely change it in the preview
- A capture from hotkey to "Caught ✓" feels faster than grabbing a card
- I finish comfortable with the Claude API: prompting, structured output, failure handling

## Open Questions

- Whether Opus at low effort is fast enough for capture, or a smaller model is needed (measure)
