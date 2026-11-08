# Break It Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A **Break it down** button on the card page that has Claude (with web search) propose steps, some with real links, which the user ticks and adds as subtasks.

**Architecture:** A new server module `src/lib/server/breakdown/` builds the Claude request (Haiku + `web_search_20250305`), interprets the reply, and keeps a step's link only if its URL appeared in that reply's search results. Two JSON endpoints under `/api/cards/[id]/` propose steps and append the kept ones. `subtasks` gains `url` and `link_title` columns, and the card page's Save round-trips them.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, Tailwind 4, Cloudflare Workers + D1 via Drizzle, `@anthropic-ai/sdk`, zod, Vitest (better-sqlite3), Playwright (`FAKE_CLAUDE=1`).

**Spec:** `docs/superpowers/specs/2026-11-08-break-it-down-design.md`

## Global Constraints

- Model `claude-haiku-5-5` (reuse `PARSE_MODEL`); do not change it or the 5 s `PARSE_TIMEOUT_MS`. Moving to Sonnet is Gary's call.
- Breakdown timeout `BREAKDOWN_TIMEOUT_MS = 30_000`, `maxRetries: 0`.
- Web search tool `{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }`.
- 3–8 steps (`MAX_BREAKDOWN_STEPS = 8`); each step text ≤ `MAX_TITLE_LENGTH`.
- A press counts one sort via `countParse`; admins aren't counted; limit `DAILY_PARSE_LIMIT` (20, UTC day).
- Only `http:`/`https:` URLs, ≤ 2000 chars, ever stored or rendered; link titles ≤ `MAX_TITLE_LENGTH`.
- Total subtasks never exceed `MAX_SUBTASKS` (50).
- Failure copy: "Couldn't break this down right now. Try again later."
- Link button: ≥ 44 px, `target="_blank" rel="noopener noreferrer"`, accessible name `Open: <link title>`.
- Conventional commits, no Co-Authored-By / "Generated with Claude Code" lines.

## Review Focus

- Pressing Add with unsaved title/notes edits: the edits stay in the fields; a later Save keeps both edits and new steps.
- A step whose link Claude invented (not in the search results) keeps its text and loses its link.
- A tampered Save posting `subtask_url=javascript:alert(1)`: stored as no link.
- A card already at 48 saved subtasks + 3 unsaved rows: no more steps can be added than fit, and the UI says so.
- Another user's card id posted to either endpoint: 404, nothing counted or written.

---

### Task 1: Spike Haiku + web search (go/no-go)

**Files:**
- Create (scratchpad, not committed): `spike-breakdown.mjs`

- [ ] **Step 1:** Write a Node script using `@anthropic-ai/sdk` and the key in `.dev.vars` (`ANTHROPIC_API_KEY`) that sends `model: 'claude-haiku-5-5'`, `max_tokens: 4096`, `output_config: { effort: 'low', format: { type: 'json_schema', schema } }` (schema: `{ steps: [{ text, url, linkTitle }] }`, `url`/`linkTitle` strings that may be empty), the web search tool above, and the card "Learn more about graphs and how they apply to our AI project". Print `stop_reason`, the elapsed time, each content block's `type`, every `web_search_result` `url`/`title`, and the final text.
- [ ] **Step 2:** Run it twice. Record: does the API accept `output_config.format` with the tool (if 400, rerun without it and ask for JSON in the prompt); time per call; whether step URLs appear among the search results.
- [ ] **Step 3: Gate.** If Haiku is rejected for the tool or returns no search results, **stop and ask Gary** (Sonnet decision). Otherwise write the findings (format works or not, typical latency) at the top of Task 3's notes and continue. Use what the spike showed for `stop_reason` handling (`pause_turn` counts as failure).

### Task 2: Subtask links in the data layer

**Files:**
- Modify: `src/lib/server/db/schema.ts` (subtasks), `src/lib/server/cards.ts`, `src/routes/card/[id]/+page.server.ts`
- Create: `drizzle/0003_*.sql` (via `npm run db:generate`), `src/lib/server/links.ts`, `src/lib/server/links.test.ts`
- Test: `src/lib/server/cards.test.ts`

**Interfaces:**
- Produces:
  - `httpUrl(raw: unknown): string | null` — trimmed URL if it parses with protocol `http:`/`https:` and length ≤ 2000, else null.
  - `sameUrl(a: string, b: string): boolean` — equal after lowercasing host, dropping `www.`, a trailing `/`, and the fragment.
  - `sameStepText(a: string, b: string): boolean` — equal after trim, collapse whitespace, lowercase.
  - `SubtaskInput { text: string; done: boolean; url?: string | null; linkTitle?: string | null }`
  - `Subtask { id: string; text: string; done: boolean; url: string | null; linkTitle: string | null }` (from `getCard`)
  - `appendSubtasks(db: Db, userId: string, cardId: string, items: { text: string; url: string | null; linkTitle: string | null }[]): Promise<Subtask[]>` — appends after the highest `sort_order`, `done: false`; skips items whose text `sameStepText` an existing subtask or an earlier item; keeps only as many as fit under `MAX_SUBTASKS`; reindexes; throws `NotFoundError` for another user's card; returns the card's full subtask list.

- [ ] **Step 1: Write failing tests**
  - `links.test.ts`: `httpUrl('https://x.dev/a')` → same; `httpUrl('javascript:alert(1)')`, `httpUrl('ftp://x')`, `httpUrl('not a url')`, `httpUrl('https://x.dev/' + 'a'.repeat(2000))`, `httpUrl(42)` → null. `sameUrl('https://www.x.dev/a/', 'https://x.dev/a')` true; `sameUrl('https://x.dev/a', 'https://x.dev/b')` false. `sameStepText(' Read  the Paper ', 'read the paper')` true.
  - `cards.test.ts` → `describe('appendSubtasks')`: appends after existing in order with url/linkTitle returned by `getCard`; skips a case/space duplicate of an existing subtask; with 49 existing, appending 3 keeps 1; another user's card throws `NotFoundError`; the appended text is findable with `searchCards`.
  - `cards.test.ts` → `setSubtasks` keeps `url`/`linkTitle` when passed and stores null when omitted.
- [ ] **Step 2:** Run `npx vitest run src/lib/server/links.test.ts src/lib/server/cards.test.ts` — expect FAIL (missing exports/columns).
- [ ] **Step 3:** Add `url: text('url')` and `link_title: text('link_title')` (nullable) to `subtasks`; run `npm run db:generate` and commit the generated `0003` SQL + meta. Implement `links.ts`; extend `insertSubtasks`, `getCard` (select `url`, `link_title` as `linkTitle`), and add `appendSubtasks`.
- [ ] **Step 4:** In the card `save` action, read `subtask_url` and `subtask_link_title` as parallel fields (same index as `subtask_text`); `url: httpUrl(...)`, `linkTitle` trimmed and clamped to `MAX_TITLE_LENGTH`, null when the url is null. Add a test for the action's row mapping by extracting it to `subtaskRowsFromForm(form: FormData): SubtaskInput[]` in `src/lib/server/validation.ts` with a test in `validation.test.ts`: a `javascript:` url row yields `url: null, linkTitle: null`; blank-text rows are still dropped; done flags keep their index.
- [ ] **Step 5:** Run `npx vitest run` — expect all PASS.
- [ ] **Step 6:** Commit `feat: subtasks can carry a link`.

### Task 3: Breakdown module and fake client

**Files:**
- Create: `src/lib/server/breakdown/breakdown.ts`, `src/lib/server/breakdown/schema.ts`, `src/lib/server/breakdown/breakdown.test.ts`
- Modify: `src/lib/server/parse/fake-client.ts`

**Interfaces:**
- Consumes: `PARSE_MODEL`, `httpUrl`, `sameUrl`, `sameStepText`, `MAX_TITLE_LENGTH`.
- Produces:
  - `BreakdownCard { title: string; notes: string | null; pileName: string; subtasks: string[] }`
  - `ProposedStep { text: string; url: string | null; linkTitle: string | null }`
  - `BREAKDOWN_TIMEOUT_MS = 30_000`, `MAX_BREAKDOWN_STEPS = 8`, `BREAKDOWN_MAX_SEARCHES = 4`
  - `buildBreakdownRequest(card: BreakdownCard)` — the request body (model, `max_tokens: 4096`, effort low, the web search tool, format per the spike, system prompt, user message listing title, notes, pile, existing subtasks).
  - `interpretBreakdown(response: { stop_reason: string | null; content: Array<{ type: string; [k: string]: unknown }> }, existing: string[]): ProposedStep[] | null`
  - `breakdownCard(client: Anthropic | null, card: BreakdownCard): Promise<ProposedStep[] | null>` — never throws; null on no client, error, timeout, or bad reply.

- [ ] **Step 1: Write failing tests** in `breakdown.test.ts`:
  - `buildBreakdownRequest`: model is `'claude-haiku-5-5'`; `tools` equals `[{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }]`; the user message contains the title, notes, pile name and each existing subtask; the system prompt says links must come from search results and not to repeat existing subtasks.
  - `interpretBreakdown` with a reply containing a `web_search_tool_result` (`content: [{ type: 'web_search_result', url: 'https://www.youtube.com/watch?v=abc', title: 'Graph Databases in 10 Minutes' }]`) and steps `[{ text: 'Watch an intro', url: 'https://youtube.com/watch?v=abc', linkTitle: 'whatever' }, { text: 'Read the paper', url: 'https://arxiv.org/made-up', linkTitle: 'x' }, { text: 'Sketch where it fits', url: '', linkTitle: '' }]`:
    - first step → `url: 'https://www.youtube.com/watch?v=abc'`, `linkTitle: 'Graph Databases in 10 Minutes'` (result's URL and title)
    - second → `url: null, linkTitle: null`, text kept
    - third → no link
  - drops a step that `sameStepText` an `existing` entry; drops blank steps; caps at 8; clamps text to `MAX_TITLE_LENGTH`.
  - returns null for `stop_reason` `'refusal'`, `'max_tokens'`, `'pause_turn'`; for invalid JSON; for a wrong shape; and for zero usable steps.
  - a search-result URL that is `javascript:` is never matched.
  - `breakdownCard(null, card)` → null; a client whose `create` rejects → null; passes `{ timeout: 30000, maxRetries: 0 }`.
- [ ] **Step 2:** Run `npx vitest run src/lib/server/breakdown` — expect FAIL.
- [ ] **Step 3:** Implement. Read the steps JSON from the **last** `text` block (web search replies have text before and between tool blocks); validate with a zod schema in `schema.ts`. Collect search results from every `web_search_tool_result` block whose `content` is an array (an error result is an object — skip it).
- [ ] **Step 4:** Extend `fakeParseClient().messages.create`: when `params.tools` is present, throw if the user message contains `[fail]`; otherwise return `stop_reason: 'end_turn'` with a `web_search_tool_result` holding one result `{ url: 'https://example.com/graph-intro', title: 'Graph Databases in 10 Minutes' }` and a final text block with steps `Watch an intro to graph databases` (url `https://example.com/graph-intro`), `Read the GraphRAG paper` (url `https://example.com/invented`, not in results), `Sketch where a graph fits`. Add a unit test that `interpretBreakdown` on the fake reply keeps exactly one link.
- [ ] **Step 5:** Run `npx vitest run` — PASS.
- [ ] **Step 6:** Commit `feat: Claude breaks a card into steps with searched links`.

### Task 4: Endpoints and sorts-left

**Files:**
- Create: `src/routes/api/cards/[id]/breakdown/+server.ts`, `src/routes/api/cards/[id]/subtasks/+server.ts`
- Modify: `src/lib/server/usage.ts` (+ `usage.test.ts`), `src/routes/card/[id]/+page.server.ts` (load), `src/lib/server/validation.ts` (+ test)

**Interfaces:**
- Consumes: `breakdownCard`, `appendSubtasks`, `httpUrl`, `countParse`, `getCard`, `getParseClient`.
- Produces:
  - `parsesToday(db: Db, userId: string, now?: Date): Promise<number>` — today's count, 0 if no row.
  - Card page load adds `sortsLeft: number | null` (null for admins; else `max(0, DAILY_PARSE_LIMIT - parsesToday)`).
  - `POST /api/cards/[id]/breakdown` (no body) → 200 `{ steps: ProposedStep[], sortsLeft: number | null }`; 404 not your card; 400 card is done; 429 `{ error: 'out-of-sorts' }` (non-admin and `countParse` > limit — Claude not called); 502 `{ error: 'failed', sortsLeft }` when `breakdownCard` returns null.
  - `POST /api/cards/[id]/subtasks` body `{ steps: { text: string; url: string | null; linkTitle: string | null }[] }` (1–`MAX_BREAKDOWN_STEPS` items, text 1–`MAX_TITLE_LENGTH`) → 200 `{ subtasks: Subtask[] }`; 400 bad body; 404 not your card. Each `url` passes through `httpUrl`; `linkTitle` is nulled when url is null. Validate with `appendStepsSchema` in `validation.ts`.

- [ ] **Step 1: Write failing tests**: `usage.test.ts` → `parsesToday` returns 0 then 2 after two `countParse` calls, and ignores yesterday's row. `validation.test.ts` → `appendStepsSchema` rejects 0 steps, 9 steps, a 201-char text; accepts `url: null`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement both, the two endpoints (follow `/api/parse/+server.ts`: `requireUser`, `getParseClient(env.ANTHROPIC_API_KEY)`; look up the card with `getCard` **before** counting so a 404 never spends a sort), and the load field. **Step 4:** `npx vitest run` and `npm run check` — PASS.
- [ ] **Step 5:** Commit `feat: endpoints to propose and add breakdown steps`.

### Task 5: Card page UI, e2e, docs

**Files:**
- Modify: `src/routes/card/[id]/+page.svelte`, `CLAUDE.md`, `README.md`, `DESIGN.md`
- Create: `e2e/breakdown.test.ts`

**Interfaces:**
- Consumes: both endpoints, `data.sortsLeft`, `Subtask.url`/`linkTitle`.

UI behaviour (copy is fixed here):
- `rows` items become `{ text, done, url, linkTitle }`; `seed()` copies them; each row posts hidden `subtask_url` and `subtask_link_title`. A row with a url shows a round ↗ link (`size-11`, `aria-label="Open: {linkTitle}"`, `title` the same) between the text input and the remove button.
- Under the Subtasks list, for active cards only: button **Break it down** (`btn-soft`). While waiting: disabled, text **Finding steps…**, `aria-busy`. When `sortsLeft === 0`: disabled, with "You're out of sorts for today." beside it.
- Proposals: a `fieldset` with legend **Suggested steps**, one checkbox per step (all checked; label = step text; under it the link title and host in muted text when linked). Proposals that `sameStepText` a current row are hidden. Room = `MAX_SUBTASKS - max(data.card.subtasks.length, rows.length)`; if checked count > room, show "Only {room} more fit on this card." and disable Add. Buttons **Add {n} steps** (`btn-primary`, singular "Add 1 step", disabled at 0) and **Cancel** (`btn-quiet`).
- Add: POST kept steps; on success append the returned new rows (those whose ids weren't in the last-known list) to `rows` without calling `update`/`invalidate`, clear proposals, and announce "Added {n} steps" in a `role="status"`. On error show the failure copy in `role="alert"`. After any press, update the local `sortsLeft` from the response.

- [ ] **Step 1: Write failing e2e tests** in `e2e/breakdown.test.ts` (use `signUp`, `capture`, `waitForHydration` from `./helpers`):
  - `break a card down and keep two steps`: capture "Learn about graphs", open it, edit Title to "Learn about graph databases" (don't save), press **Break it down**, see 3 suggestions, untick "Read the GraphRAG paper", press **Add 2 steps** → status "Added 2 steps"; Title field still shows the unsaved edit; `getByRole('link', { name: 'Open: Graph Databases in 10 Minutes' })` has `href` `https://example.com/graph-intro` and `target` `_blank`; no link named for the paper. Press **Save changes**, reload: two subtasks present and the link still there.
  - `a failed breakdown adds nothing`: capture "[fail] Learn graphs", press Break it down → alert "Couldn't break this down right now. Try again later."; no subtasks.
  - `out of sorts`: make 20 `page.request.post('/api/parse', { data: { text: 'x' } })` calls, open a card → button disabled and "You're out of sorts for today." visible.
  - `done cards have no button`: mark a card done → no **Break it down** button.
  - `with 200% text on a 320px phone the suggestions fit`: as in `e2e/users.test.ts`, after suggestions show, `scrollWidth - clientWidth <= 0`.
- [ ] **Step 2:** Run `npx playwright test e2e/breakdown.test.ts` — FAIL. **Step 3:** Implement the UI. **Step 4:** Run `npx playwright test e2e/breakdown.test.ts e2e/card.test.ts` — PASS.
- [ ] **Step 5:** Docs: CLAUDE.md "Rules for this repo" — one sentence that Break it down uses Haiku + web search, 30 s timeout, counts as a sort, links only from search results. README features list — one bullet. DESIGN.md card page section — the ↗ link button and the suggestions checklist.
- [ ] **Step 6:** Full gate: `npm run check`, `npm run lint` (ignore the untracked `.github/agents|hooks|skills` and `.impeccable` noise), `npm test` — all PASS.
- [ ] **Step 7:** Commit `feat: Break it down on the card page`.
