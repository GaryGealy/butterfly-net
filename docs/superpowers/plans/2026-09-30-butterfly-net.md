# butterfly-net Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build butterfly-net, a cloud web app of digital 3×5 cards: dictate or type a thought, Claude proposes which pile it belongs on, you confirm, and the card sits on its pile until you mark it done.

**Architecture:** One SvelteKit app on Cloudflare Pages, backed by a D1 database (better-sqlite3 locally) through Drizzle. Domain logic lives in small server modules (`piles`, `cards`, `search`, `parse`, `auth`), each taking a `Db` and a `userId` so every query is user-scoped and unit-testable against an in-memory SQLite. Claude is called only from `POST /api/parse`; capture never depends on it succeeding.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes), TypeScript, Tailwind CSS 4, Drizzle ORM, Cloudflare D1 + FTS5, Zod 4, `@anthropic-ai/sdk`, Vitest, Playwright, Wrangler.

**Spec:** `docs/superpowers/specs/2026-09-30-butterfly-net-design.md` (copied from idea-forge, where the idea is tracked as `digital-assistant`)

## Global Constraints

- Build repo: `~/repos/company-of-one/butterfly-net`. All work on branch `feat/v1`, never committed directly to `main`.
- Commit messages: conventional (`feat:`, `chore:`, `test:`, `ci:`, `docs:`). **No** `Co-Authored-By` or "Generated with Claude Code" lines.
- Node 22. npm (not pnpm).
- Default piles, exactly, in this order: `house`, `work stuff`, `ideas`, `video games`, `model building`.
- Claude model: `claude-opus-5-5`, `effort: 'low'`, structured outputs via `output_config.format`, server-side `fallbacks: 'default'` (beta `server-side-fallback-2026-07-01`). Changing the model is a one-line edit to `PARSE_MODEL`; do not change it in this plan.
- Parse timeout: 5000 ms, no SDK retries. The API key is server-only (Cloudflare secret / `.dev.vars`), never sent to the browser.
- Nothing is saved until the user confirms the preview. If Claude fails, times out, refuses, or returns invalid output, the preview still appears with the raw text and no pile.
- Voice is the primary input, via **macOS Dictation** into the capture box; the app ships **no** voice code (no mic button, no Web Speech API, no voice commands). Capture text is often dictated — run-on, unpunctuated, with filler — and `SYSTEM_PROMPT` must say so.
- v1 has **no** due dates, reminders, priority, recurrence, in-app voice, offline queue, integrations, or export.
- Auth: email/password, PBKDF2-SHA256 via Web Crypto at 100,000 iterations, session cookie `session` (httpOnly, sameSite lax, secure outside dev), 30-day sessions.
- Every read and write of piles, cards, subtasks and search is scoped by `user_id`. Another user's id behaves exactly like a nonexistent id (404 / `NotFoundError`).
- Plan-set limits (enforced server-side): capture text ≤ 2000 chars; title ≤ 200; notes ≤ 5000; pile name ≤ 40; ≤ 50 subtasks per card, each ≤ 200; Claude-proposed subtasks capped at 20.
- Production deploys fire **only** on a pushed `v*` tag. CI runs on pushes and PRs.
- Timestamps are stored as `timestamp_ms` so ordering ("newest first") is stable within a second.

## Review Focus

1. **Search text containing FTS5 syntax** (`"`, `*`, `(`, `-`, `AND`, `NEAR`) must return results or an empty list — never a 500. Pinned in Task 6.
2. **A pile name that differs only in case or surrounding spaces** from an existing pile (from Claude or typed by the user) must reuse the existing pile, never create a near-duplicate. Pinned in Tasks 3, 7 and 8.
3. **Capture text longer than 200 characters when Claude is unavailable** must still be savable: title truncated with `…`, full text kept in notes. Pinned in Task 7.
4. **Another user's card or pile id** passed to any action or URL must behave as not found and change nothing. Pinned in Tasks 3, 5 and 11.
5. **Deleting a pile whose only cards are archived** must still require reassigning them (they would otherwise be orphaned). Pinned in Task 3.

---

## File Structure

```
butterfly-net/
├── .github/workflows/ci.yml              # unit + e2e on push/PR
├── .github/workflows/deploy.yml          # deploy on v* tag only
├── drizzle/                              # generated SQL migrations (+ custom FTS migration)
├── drizzle.config.ts
├── e2e/
│   ├── helpers.ts                        # signUp(), capture()
│   ├── auth.test.ts
│   ├── capture.test.ts
│   ├── card.test.ts
│   ├── search-archive.test.ts
│   ├── piles.test.ts
│   └── pwa.test.ts
├── playwright.config.ts
├── scripts/smoke-parse.ts                # manual live Claude check
├── src/
│   ├── app.d.ts
│   ├── hooks.server.ts                   # db + session + auth gate
│   ├── service-worker.ts                 # minimal, enables PWA install
│   ├── lib/
│   │   ├── types.ts                      # PileRef, ParsedPile, ParseResult (shared client/server)
│   │   ├── components/CaptureBox.svelte  # capture → preview → save
│   │   └── server/
│   │       ├── db/{index,schema,raw}.ts
│   │       ├── db/schema.test.ts
│   │       ├── test/db.ts                # createTestDb(), createTestUser()
│   │       ├── errors.ts
│   │       ├── password.ts (+ .test.ts)
│   │       ├── auth.ts (+ .test.ts)
│   │       ├── session-cookie.ts
│   │       ├── routes.ts (+ .test.ts)    # isPublicPath, safeNext, requireUser
│   │       ├── piles.ts (+ .test.ts)
│   │       ├── cards.ts (+ .test.ts)
│   │       ├── search-index.ts           # cards_fts maintenance
│   │       ├── search.ts (+ .test.ts)
│   │       ├── validation.ts (+ .test.ts)
│   │       ├── capture.ts (+ .test.ts)
│   │       └── parse/{schema,parse,client,fake-client}.ts, parse.test.ts
│   └── routes/
│       ├── +layout.svelte, +layout.server.ts, layout.css
│       ├── +page.svelte, +page.server.ts           # piles view
│       ├── quick-add/+page.svelte, +page.server.ts
│       ├── card/[id]/+page.svelte, +page.server.ts
│       ├── search/+page.svelte, +page.server.ts
│       ├── archive/+page.svelte, +page.server.ts
│       ├── piles/+page.svelte, +page.server.ts
│       ├── login/, signup/, logout/
│       └── api/parse/+server.ts, api/cards/+server.ts
├── static/manifest.webmanifest, static/icons/
└── wrangler.toml
```

---

### Task 1: Scaffold the repo

**Files:**
- Create: the whole SvelteKit scaffold under `~/repos/company-of-one/butterfly-net`
- Modify: `vite.config.ts`, `playwright.config.ts`, `package.json` scripts, `.gitignore`
- Create: `wrangler.toml`

**Interfaces:**
- Consumes: nothing
- Produces: a building, type-checking app on branch `feat/v1`; scripts `test:unit`, `test:e2e`, `db:generate`, `db:migrate:dev`, `db:migrate:remote`, `preview`

The repo already exists: `~/repos/company-of-one/butterfly-net` is a clone of the empty
GitHub repo `GaryGealy/butterfly-net` (default branch `main`, no commits). Do not run
`git init` or `gh repo create`. `CLAUDE.md` and `docs/superpowers/` (this plan and the
spec) are already in the folder, uncommitted; leave them out of the empty root commit and
let Step 9's `git add -A` commit them on `feat/v1` with the scaffold.

- [ ] **Step 1: Point the remote at SSH and start `main` with an empty root commit**

The clone uses an HTTPS remote, but `gh`'s HTTPS credential helper serves Gary's work
account, so pushes to his personal repos must go over SSH.

```bash
cd ~/repos/company-of-one/butterfly-net
git remote set-url origin git@github.com:GaryGealy/butterfly-net.git
git remote -v   # expect git@github.com:GaryGealy/butterfly-net.git for fetch and push
git commit --allow-empty -m "chore: initial commit"
git push -u origin main
git checkout -b feat/v1
```

Expected: `main` exists on GitHub with one empty commit; you are on `feat/v1`.

- [ ] **Step 2: Scaffold into a sibling folder, then move it into the repo**

`sv create` expects a new directory, so generate the app beside the repo and copy it in
(everything except a `.git`), then delete the temporary folder.

```bash
cd ~/repos/company-of-one
npx sv create butterfly-net-scaffold --template minimal --types ts \
  --add prettier eslint vitest="usages:unit" playwright tailwindcss="plugins:forms" \
        sveltekit-adapter="adapter:cloudflare+cfTarget:pages" \
  --no-install
rsync -a --exclude .git butterfly-net-scaffold/ butterfly-net/
rm -rf butterfly-net-scaffold
cd butterfly-net
npm install
```

Expected: `package.json`, `src/`, `svelte.config.js` and the sv config files are in
`butterfly-net/`; `git status` shows them as untracked on `feat/v1`.

- [ ] **Step 3: Install runtime and dev dependencies**

```bash
npm i drizzle-orm zod @anthropic-ai/sdk@latest
npm i -D drizzle-kit better-sqlite3 @types/better-sqlite3 @types/node wrangler @cloudflare/workers-types tsx
```

- [ ] **Step 4: Replace `vite.config.ts`**

```ts
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		expect: { requireAssertions: true },
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
```

- [ ] **Step 5: Replace `playwright.config.ts`**

E2E runs its own dev server on port 5174 against a throwaway `e2e.db`, with the deterministic fake Claude (added in Task 7).

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: { baseURL: 'http://localhost:5174', trace: 'on-first-retry' },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'rm -f e2e.db && npx drizzle-kit migrate && npx vite dev --port 5174 --strictPort',
		port: 5174,
		reuseExistingServer: false,
		env: { DATABASE_URL: 'e2e.db', FAKE_CLAUDE: '1' },
		timeout: 120_000
	}
});
```

- [ ] **Step 6: Create `wrangler.toml`** (the D1 block is added in Task 15, once the database exists)

```toml
name = "butterfly-net"
compatibility_date = "2026-09-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".svelte-kit/cloudflare"
```

- [ ] **Step 7: Set package scripts and ignore local databases/secrets**

```bash
npm pkg set scripts.test:unit="vitest" \
  scripts.test:e2e="playwright test" \
  scripts.test="npm run test:unit -- --run && npm run test:e2e" \
  scripts.db:generate="drizzle-kit generate" \
  scripts.db:migrate:dev="drizzle-kit migrate" \
  scripts.db:migrate:remote="wrangler d1 migrations apply butterfly-net-db --remote" \
  scripts.preview="wrangler pages dev .svelte-kit/cloudflare"
printf '\n# Local databases and secrets\n*.db\n.dev.vars\n.wrangler\n' >> .gitignore
```

- [ ] **Step 8: Verify the scaffold builds and its demo test passes**

Run: `npm run check && npm run test:unit -- --run && npm run build`
Expected: svelte-check reports 0 errors; the sv demo unit test passes; build writes `.svelte-kit/cloudflare`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold SvelteKit app for Cloudflare Pages"
```

---

### Task 2: Database schema, migrations, and test harness

**Files:**
- Create: `src/lib/server/db/schema.ts`, `src/lib/server/db/index.ts`, `src/lib/server/db/raw.ts`, `drizzle.config.ts`
- Create: `src/lib/server/test/db.ts`
- Create: `drizzle/0000_*.sql` (generated), `drizzle/0001_cards_fts.sql` (custom)
- Test: `src/lib/server/db/schema.test.ts`
- Delete: the sv demo tests (`src/demo.spec.ts`, `e2e/demo.test.ts`)

**Interfaces:**
- Consumes: nothing
- Produces:
  - Tables `users`, `sessions`, `piles`, `cards`, `subtasks` (Drizzle objects exported from `schema.ts`) and FTS5 table `cards_fts(card_id UNINDEXED, user_id UNINDEXED, title, notes, subtasks)`
  - `type Db` and `getDb(d1?: D1Database): Promise<Db>` from `$lib/server/db`
  - `runSql(db: Db, query: SQL): Promise<void>` and `allSql<T>(db: Db, query: SQL): Promise<T[]>` from `$lib/server/db/raw`
  - `createTestDb(): Db` and `createTestUser(db: Db, email?: string): Promise<string>` from `$lib/server/test/db`

- [ ] **Step 1: Write the schema** — `src/lib/server/db/schema.ts`

```ts
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
	integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date());

export const users = sqliteTable('users', {
	id: id(),
	email: text('email').notNull().unique(),
	password_hash: text('password_hash').notNull(),
	created_at: createdAt()
});

export const sessions = sqliteTable('sessions', {
	id: id(),
	user_id: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expires_at: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
	created_at: createdAt()
});

export const piles = sqliteTable(
	'piles',
	{
		id: id(),
		user_id: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		sort_order: integer('sort_order').notNull(),
		created_at: createdAt()
	},
	(t) => [uniqueIndex('piles_user_name_idx').on(t.user_id, t.name)]
);

export const cards = sqliteTable(
	'cards',
	{
		id: id(),
		user_id: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		pile_id: text('pile_id')
			.notNull()
			.references(() => piles.id),
		title: text('title').notNull(),
		notes: text('notes'),
		status: text('status', { enum: ['active', 'done'] })
			.notNull()
			.default('active'),
		created_at: createdAt(),
		done_at: integer('done_at', { mode: 'timestamp_ms' })
	},
	(t) => [index('cards_user_status_idx').on(t.user_id, t.status)]
);

export const subtasks = sqliteTable('subtasks', {
	id: id(),
	card_id: text('card_id')
		.notNull()
		.references(() => cards.id, { onDelete: 'cascade' }),
	text: text('text').notNull(),
	done: integer('done', { mode: 'boolean' }).notNull().default(false),
	sort_order: integer('sort_order').notNull()
});
```

- [ ] **Step 2: Write `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: { url: process.env.DATABASE_URL || 'local.db' }
});
```

- [ ] **Step 3: Generate the table migration and a custom FTS migration**

```bash
npm run db:generate
npx drizzle-kit generate --custom --name=cards_fts
```

Then replace the contents of the generated `drizzle/0001_cards_fts.sql` with:

```sql
CREATE VIRTUAL TABLE `cards_fts` USING fts5(
	card_id UNINDEXED,
	user_id UNINDEXED,
	title,
	notes,
	subtasks,
	tokenize = 'porter unicode61'
);
```

- [ ] **Step 4: Write `src/lib/server/db/index.ts`** (the DealOps pattern: D1 in production, better-sqlite3 in dev and tests)

```ts
import type { D1Database } from '@cloudflare/workers-types';
import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { dev } from '$app/environment';
import * as schema from './schema';

export type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

let localDb: BetterSQLite3Database<typeof schema> | null = null;

/**
 * D1 when running on Cloudflare; a local SQLite file (DATABASE_URL, default local.db) in dev.
 */
export async function getDb(d1?: D1Database): Promise<Db> {
	if (!dev && d1) return drizzleD1(d1, { schema });

	if (!localDb) {
		const { drizzle } = await import('drizzle-orm/better-sqlite3');
		const Database = (await import('better-sqlite3')).default;
		const path = await import('node:path');
		const sqlite = new Database(path.join(process.cwd(), process.env.DATABASE_URL || 'local.db'));
		sqlite.pragma('foreign_keys = ON');
		localDb = drizzle(sqlite, { schema });
	}
	return localDb;
}
```

- [ ] **Step 5: Write `src/lib/server/db/raw.ts`**

```ts
import type { SQL } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { Db } from './index';
import type * as schema from './schema';

// Drizzle's D1 and better-sqlite3 databases both have run() and all(), but one is
// async and one is sync, so TypeScript can't call them through the Db union. Both
// results are awaitable, which is all these helpers rely on.
type AnyDb = BetterSQLite3Database<typeof schema>;

export async function runSql(db: Db, query: SQL): Promise<void> {
	await (db as AnyDb).run(query);
}

export async function allSql<T>(db: Db, query: SQL): Promise<T[]> {
	return await (db as AnyDb).all<T>(query);
}
```

- [ ] **Step 6: Write the test harness** — `src/lib/server/test/db.ts`

```ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Db } from '../db';
import * as schema from '../db/schema';

/** A fresh in-memory database with every migration applied. */
export function createTestDb(): Db {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: 'drizzle' });
	return db;
}

/** Inserts a user directly (no password hashing) and returns its id. */
export async function createTestUser(
	db: Db,
	email = `user-${crypto.randomUUID()}@test.dev`
): Promise<string> {
	const [user] = await db
		.insert(schema.users)
		.values({ email, password_hash: 'unused' })
		.returning({ id: schema.users.id });
	return user.id;
}
```

- [ ] **Step 7: Write the failing test** — `src/lib/server/db/schema.test.ts`, and delete the sv demo tests

```bash
rm -f src/demo.spec.ts e2e/demo.test.ts
```

```ts
import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestDb, createTestUser } from '../test/db';
import { allSql } from './raw';
import { piles } from './schema';

describe('migrations', () => {
	it('create every table, including the cards_fts search index', async () => {
		const db = createTestDb();
		const rows = await allSql<{ name: string }>(
			db,
			sql`SELECT name FROM sqlite_master WHERE type = 'table'`
		);
		const names = rows.map((r) => r.name);
		for (const table of ['users', 'sessions', 'piles', 'cards', 'subtasks', 'cards_fts']) {
			expect(names).toContain(table);
		}
	});

	it('allow a pile name only once per user', async () => {
		const db = createTestDb();
		const userId = await createTestUser(db);
		await db.insert(piles).values({ user_id: userId, name: 'house', sort_order: 0 });
		await expect(
			db.insert(piles).values({ user_id: userId, name: 'house', sort_order: 1 })
		).rejects.toThrow();
	});
});
```

- [ ] **Step 8: Run the tests**

Run: `npm run test:unit -- --run src/lib/server/db`
Expected: 2 tests PASS. (If `cards_fts` is missing, check that `drizzle/0001_cards_fts.sql` holds the `CREATE VIRTUAL TABLE` and that `drizzle/meta/_journal.json` lists it.)

- [ ] **Step 9: Create the local dev database**

Run: `npm run db:migrate:dev`
Expected: `local.db` created (gitignored).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add database schema, migrations, and test harness"
```

---

### Task 3: Piles

**Files:**
- Create: `src/lib/server/errors.ts`, `src/lib/server/piles.ts`
- Test: `src/lib/server/piles.test.ts`

**Interfaces:**
- Consumes: `Db`, `createTestDb`, `createTestUser`, `piles`, `cards` tables (Task 2)
- Produces:
  - `class NotFoundError(what: string)`, `class PileNotEmptyError(cardCount: number)` with `.cardCount`, `class DuplicatePileError(name: string)`
  - `DEFAULT_PILES: readonly string[]`
  - `interface Pile { id: string; name: string; sort_order: number }`, `interface PileWithCount extends Pile { card_count: number }`
  - `seedDefaultPiles(db, userId): Promise<void>`
  - `listPiles(db, userId): Promise<Pile[]>` (by `sort_order`)
  - `listPilesWithCounts(db, userId): Promise<PileWithCount[]>` (counts active + done cards)
  - `getPile(db, userId, pileId): Promise<Pile | null>`
  - `findPileByName(db, userId, name): Promise<Pile | null>` (case-insensitive, trimmed)
  - `createPile(db, userId, name): Promise<Pile>` (returns the existing pile on a case-insensitive match)
  - `renamePile(db, userId, pileId, name): Promise<void>` (throws `DuplicatePileError`, `NotFoundError`)
  - `movePile(db, userId, pileId, direction: 'up' | 'down'): Promise<void>`
  - `deletePile(db, userId, pileId, reassignToPileId?: string): Promise<void>` (throws `PileNotEmptyError` when the pile has any card, active or done, and no valid target)

- [ ] **Step 1: Write `src/lib/server/errors.ts`**

```ts
export class NotFoundError extends Error {
	constructor(what: string) {
		super(`${what} not found`);
		this.name = 'NotFoundError';
	}
}

export class PileNotEmptyError extends Error {
	cardCount: number;
	constructor(cardCount: number) {
		super(`Pile still has ${cardCount} card(s)`);
		this.name = 'PileNotEmptyError';
		this.cardCount = cardCount;
	}
}

export class DuplicatePileError extends Error {
	constructor(name: string) {
		super(`A pile named "${name}" already exists`);
		this.name = 'DuplicatePileError';
	}
}
```

- [ ] **Step 2: Write the failing tests** — `src/lib/server/piles.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from './db';
import { cards } from './db/schema';
import { DuplicatePileError, NotFoundError, PileNotEmptyError } from './errors';
import {
	DEFAULT_PILES,
	createPile,
	deletePile,
	findPileByName,
	listPiles,
	listPilesWithCounts,
	movePile,
	renamePile,
	seedDefaultPiles
} from './piles';
import { createTestDb, createTestUser } from './test/db';

let db: Db;
let userId: string;

beforeEach(async () => {
	db = createTestDb();
	userId = await createTestUser(db);
	await seedDefaultPiles(db, userId);
});

async function addCard(pileId: string, status: 'active' | 'done' = 'active') {
	await db.insert(cards).values({ user_id: userId, pile_id: pileId, title: 'a card', status });
}

describe('seedDefaultPiles', () => {
	it('creates the five default piles in order', async () => {
		const names = (await listPiles(db, userId)).map((p) => p.name);
		expect(names).toEqual([...DEFAULT_PILES]);
		expect(names).toEqual(['house', 'work stuff', 'ideas', 'video games', 'model building']);
	});
});

describe('createPile', () => {
	it('appends a new pile at the end', async () => {
		const pile = await createPile(db, userId, '  garden ');
		expect(pile.name).toBe('garden');
		const all = await listPiles(db, userId);
		expect(all.at(-1)?.id).toBe(pile.id);
	});

	it('returns the existing pile when the name differs only by case or spacing', async () => {
		const ideas = await findPileByName(db, userId, 'ideas');
		const again = await createPile(db, userId, ' IDEAS ');
		expect(again.id).toBe(ideas?.id);
		expect(await listPiles(db, userId)).toHaveLength(5);
	});
});

describe('renamePile', () => {
	it('renames a pile', async () => {
		const [house] = await listPiles(db, userId);
		await renamePile(db, userId, house.id, 'home');
		expect((await listPiles(db, userId))[0].name).toBe('home');
	});

	it('rejects a name another pile already uses, ignoring case', async () => {
		const [house] = await listPiles(db, userId);
		await expect(renamePile(db, userId, house.id, 'Ideas')).rejects.toThrow(DuplicatePileError);
	});

	it("treats another user's pile as not found", async () => {
		const otherUser = await createTestUser(db);
		await seedDefaultPiles(db, otherUser);
		const [theirs] = await listPiles(db, otherUser);
		await expect(renamePile(db, userId, theirs.id, 'mine now')).rejects.toThrow(NotFoundError);
		expect((await listPiles(db, otherUser))[0].name).toBe('house');
	});
});

describe('movePile', () => {
	it('swaps a pile with its neighbour', async () => {
		const before = await listPiles(db, userId);
		await movePile(db, userId, before[1].id, 'up');
		const after = (await listPiles(db, userId)).map((p) => p.name);
		expect(after.slice(0, 2)).toEqual(['work stuff', 'house']);
	});

	it('does nothing when moving past either end', async () => {
		const before = await listPiles(db, userId);
		await movePile(db, userId, before[0].id, 'up');
		await movePile(db, userId, before[4].id, 'down');
		expect((await listPiles(db, userId)).map((p) => p.id)).toEqual(before.map((p) => p.id));
	});
});

describe('listPilesWithCounts', () => {
	it('counts active and archived cards', async () => {
		const [house] = await listPiles(db, userId);
		await addCard(house.id, 'active');
		await addCard(house.id, 'done');
		const counts = await listPilesWithCounts(db, userId);
		expect(counts[0]).toMatchObject({ name: 'house', card_count: 2 });
		expect(counts[1]).toMatchObject({ name: 'work stuff', card_count: 0 });
	});
});

describe('deletePile', () => {
	it('deletes an empty pile', async () => {
		const [house] = await listPiles(db, userId);
		await deletePile(db, userId, house.id);
		expect((await listPiles(db, userId)).map((p) => p.name)).not.toContain('house');
	});

	it('refuses to delete a pile holding only archived cards without a target', async () => {
		const [house] = await listPiles(db, userId);
		await addCard(house.id, 'done');
		await expect(deletePile(db, userId, house.id)).rejects.toThrow(PileNotEmptyError);
	});

	it('moves every card to the target pile, then deletes', async () => {
		const [house, work] = await listPiles(db, userId);
		await addCard(house.id, 'active');
		await addCard(house.id, 'done');
		await deletePile(db, userId, house.id, work.id);
		const counts = await listPilesWithCounts(db, userId);
		expect(counts.find((p) => p.id === work.id)?.card_count).toBe(2);
	});

	it("rejects another user's pile as the target", async () => {
		const otherUser = await createTestUser(db);
		await seedDefaultPiles(db, otherUser);
		const [theirs] = await listPiles(db, otherUser);
		const [house] = await listPiles(db, userId);
		await addCard(house.id);
		await expect(deletePile(db, userId, house.id, theirs.id)).rejects.toThrow(NotFoundError);
	});
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test:unit -- --run src/lib/server/piles.test.ts`
Expected: FAIL — cannot resolve `./piles`.

- [ ] **Step 4: Implement** — `src/lib/server/piles.ts`

```ts
import { and, asc, count, eq, sql } from 'drizzle-orm';
import type { Db } from './db';
import { cards, piles } from './db/schema';
import { DuplicatePileError, NotFoundError, PileNotEmptyError } from './errors';

export const DEFAULT_PILES = [
	'house',
	'work stuff',
	'ideas',
	'video games',
	'model building'
] as const;

export interface Pile {
	id: string;
	name: string;
	sort_order: number;
}

export interface PileWithCount extends Pile {
	card_count: number;
}

const pileColumns = { id: piles.id, name: piles.name, sort_order: piles.sort_order };

export async function seedDefaultPiles(db: Db, userId: string): Promise<void> {
	await db
		.insert(piles)
		.values(DEFAULT_PILES.map((name, i) => ({ user_id: userId, name, sort_order: i })));
}

export async function listPiles(db: Db, userId: string): Promise<Pile[]> {
	return db
		.select(pileColumns)
		.from(piles)
		.where(eq(piles.user_id, userId))
		.orderBy(asc(piles.sort_order));
}

export async function listPilesWithCounts(db: Db, userId: string): Promise<PileWithCount[]> {
	return db
		.select({ ...pileColumns, card_count: count(cards.id) })
		.from(piles)
		.leftJoin(cards, eq(cards.pile_id, piles.id))
		.where(eq(piles.user_id, userId))
		.groupBy(piles.id)
		.orderBy(asc(piles.sort_order));
}

export async function getPile(db: Db, userId: string, pileId: string): Promise<Pile | null> {
	const [pile] = await db
		.select(pileColumns)
		.from(piles)
		.where(and(eq(piles.id, pileId), eq(piles.user_id, userId)))
		.limit(1);
	return pile ?? null;
}

export async function findPileByName(db: Db, userId: string, name: string): Promise<Pile | null> {
	const [pile] = await db
		.select(pileColumns)
		.from(piles)
		.where(and(eq(piles.user_id, userId), sql`lower(${piles.name}) = lower(${name.trim()})`))
		.limit(1);
	return pile ?? null;
}

export async function createPile(db: Db, userId: string, name: string): Promise<Pile> {
	const trimmed = name.trim();
	const existing = await findPileByName(db, userId, trimmed);
	if (existing) return existing;

	const [{ max }] = await db
		.select({ max: sql<number | null>`max(${piles.sort_order})` })
		.from(piles)
		.where(eq(piles.user_id, userId));
	const [pile] = await db
		.insert(piles)
		.values({ user_id: userId, name: trimmed, sort_order: (max ?? -1) + 1 })
		.returning(pileColumns);
	return pile;
}

export async function renamePile(
	db: Db,
	userId: string,
	pileId: string,
	name: string
): Promise<void> {
	const trimmed = name.trim();
	const clash = await findPileByName(db, userId, trimmed);
	if (clash && clash.id !== pileId) throw new DuplicatePileError(trimmed);

	const updated = await db
		.update(piles)
		.set({ name: trimmed })
		.where(and(eq(piles.id, pileId), eq(piles.user_id, userId)))
		.returning({ id: piles.id });
	if (updated.length === 0) throw new NotFoundError('pile');
}

export async function movePile(
	db: Db,
	userId: string,
	pileId: string,
	direction: 'up' | 'down'
): Promise<void> {
	const all = await listPiles(db, userId);
	const i = all.findIndex((p) => p.id === pileId);
	if (i === -1) throw new NotFoundError('pile');
	const j = direction === 'up' ? i - 1 : i + 1;
	if (j < 0 || j >= all.length) return;

	await db.update(piles).set({ sort_order: all[j].sort_order }).where(eq(piles.id, all[i].id));
	await db.update(piles).set({ sort_order: all[i].sort_order }).where(eq(piles.id, all[j].id));
}

export async function deletePile(
	db: Db,
	userId: string,
	pileId: string,
	reassignToPileId?: string
): Promise<void> {
	const pile = await getPile(db, userId, pileId);
	if (!pile) throw new NotFoundError('pile');

	// Counts archived cards too: they still reference this pile.
	const [{ n }] = await db.select({ n: count() }).from(cards).where(eq(cards.pile_id, pileId));
	if (n > 0) {
		if (!reassignToPileId || reassignToPileId === pileId) throw new PileNotEmptyError(n);
		const target = await getPile(db, userId, reassignToPileId);
		if (!target) throw new NotFoundError('pile');
		await db.update(cards).set({ pile_id: target.id }).where(eq(cards.pile_id, pileId));
	}
	await db.delete(piles).where(eq(piles.id, pileId));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:unit -- --run src/lib/server/piles.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/errors.ts src/lib/server/piles.ts src/lib/server/piles.test.ts
git commit -m "feat: add piles with default seeding, rename, reorder, and safe delete"
```

---

### Task 4: Passwords, users, sessions, and route guards

**Files:**
- Create: `src/lib/server/password.ts`, `src/lib/server/auth.ts`, `src/lib/server/session-cookie.ts`, `src/lib/server/routes.ts`
- Test: `src/lib/server/password.test.ts`, `src/lib/server/auth.test.ts`, `src/lib/server/routes.test.ts`

**Interfaces:**
- Consumes: `Db`, `users`, `sessions` (Task 2); `seedDefaultPiles`, `listPiles` (Task 3)
- Produces:
  - `hashPassword(password: string): Promise<string>`, `verifyPassword(password: string, stored: string): Promise<boolean>`
  - `interface SessionUser { id: string; email: string }`, `class EmailTakenError`, `SESSION_DURATION_MS`
  - `registerUser(db, email, password): Promise<SessionUser>` (normalizes email; seeds default piles)
  - `authenticate(db, email, password): Promise<SessionUser | null>`
  - `createSession(db, userId): Promise<string>`, `validateSession(db, sessionId): Promise<SessionUser | null>`, `deleteSession(db, sessionId): Promise<void>`
  - `SESSION_COOKIE_NAME`, `setSessionCookie(cookies, sessionId)`, `clearSessionCookie(cookies)`
  - `isPublicPath(pathname: string): boolean`, `safeNext(next: string | null): string`, `requireUser(locals: App.Locals): SessionUser` (throws a 401 `error`)

- [ ] **Step 1: Write the failing password test** — `src/lib/server/password.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
	it('verifies the right password and rejects a wrong one', async () => {
		const hash = await hashPassword('correct horse battery');
		expect(hash.startsWith('pbkdf2v1:100000:')).toBe(true);
		expect(await verifyPassword('correct horse battery', hash)).toBe(true);
		expect(await verifyPassword('wrong', hash)).toBe(false);
	});

	it('salts each hash', async () => {
		expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
	});

	it('rejects a malformed stored hash', async () => {
		expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- --run src/lib/server/password.test.ts`
Expected: FAIL — cannot resolve `./password`.

- [ ] **Step 3: Implement** — `src/lib/server/password.ts` (DealOps's PBKDF2, without the legacy bcrypt path)

```ts
const ITERATIONS = 100_000; // the maximum Workers' Web Crypto supports
const SALT_BYTES = 16;
const KEY_BITS = 256;
const PREFIX = 'pbkdf2v1:';

const toHex = (bytes: Uint8Array) =>
	Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) =>
	new Uint8Array((hex.match(/.{2}/g) ?? []).map((byte) => parseInt(byte, 16)));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
		key,
		KEY_BITS
	);
	return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const hash = await derive(password, salt, ITERATIONS);
	return `${PREFIX}${ITERATIONS}:${toHex(salt)}:${toHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	if (!stored.startsWith(PREFIX)) return false;
	const parts = stored.slice(PREFIX.length).split(':');
	if (parts.length !== 3) return false;
	const [iterations, saltHex, hashHex] = parts;
	const expected = fromHex(hashHex);
	const actual = await derive(password, fromHex(saltHex), Number(iterations));

	// Constant-time comparison
	if (actual.length !== expected.length) return false;
	let diff = 0;
	for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
	return diff === 0;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- --run src/lib/server/password.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing auth and routes tests**

`src/lib/server/auth.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
	EmailTakenError,
	authenticate,
	createSession,
	deleteSession,
	registerUser,
	validateSession
} from './auth';
import type { Db } from './db';
import { sessions } from './db/schema';
import { listPiles } from './piles';
import { createTestDb } from './test/db';

let db: Db;
beforeEach(() => {
	db = createTestDb();
});

describe('registerUser', () => {
	it('normalizes the email and seeds the default piles', async () => {
		const user = await registerUser(db, '  Gary@Example.COM ', 'correct horse battery');
		expect(user.email).toBe('gary@example.com');
		expect((await listPiles(db, user.id)).map((p) => p.name)).toEqual([
			'house',
			'work stuff',
			'ideas',
			'video games',
			'model building'
		]);
	});

	it('rejects an email that is already registered, ignoring case', async () => {
		await registerUser(db, 'gary@example.com', 'correct horse battery');
		await expect(registerUser(db, 'GARY@example.com', 'another password')).rejects.toThrow(
			EmailTakenError
		);
	});
});

describe('authenticate', () => {
	it('returns the user for the right password only', async () => {
		const user = await registerUser(db, 'gary@example.com', 'correct horse battery');
		expect(await authenticate(db, 'Gary@example.com', 'correct horse battery')).toEqual(user);
		expect(await authenticate(db, 'gary@example.com', 'wrong password')).toBeNull();
		expect(await authenticate(db, 'nobody@example.com', 'correct horse battery')).toBeNull();
	});
});

describe('sessions', () => {
	it('validates a live session and forgets a deleted one', async () => {
		const user = await registerUser(db, 'gary@example.com', 'correct horse battery');
		const sessionId = await createSession(db, user.id);
		expect(await validateSession(db, sessionId)).toEqual(user);
		await deleteSession(db, sessionId);
		expect(await validateSession(db, sessionId)).toBeNull();
	});

	it('rejects and removes an expired session', async () => {
		const user = await registerUser(db, 'gary@example.com', 'correct horse battery');
		const [expired] = await db
			.insert(sessions)
			.values({ user_id: user.id, expires_at: new Date(Date.now() - 1000) })
			.returning({ id: sessions.id });
		expect(await validateSession(db, expired.id)).toBeNull();
		expect(await db.select().from(sessions)).toHaveLength(0);
	});
});
```

`src/lib/server/routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isPublicPath, requireUser, safeNext } from './routes';

describe('isPublicPath', () => {
	it('allows only the auth pages and PWA assets without a session', () => {
		expect(isPublicPath('/login')).toBe(true);
		expect(isPublicPath('/signup')).toBe(true);
		expect(isPublicPath('/manifest.webmanifest')).toBe(true);
		expect(isPublicPath('/icons/icon-192.png')).toBe(true);
		expect(isPublicPath('/')).toBe(false);
		expect(isPublicPath('/api/parse')).toBe(false);
		expect(isPublicPath('/login/../card/1')).toBe(false);
	});
});

describe('safeNext', () => {
	it('keeps same-site paths and rejects everything else', () => {
		expect(safeNext('/card/abc?x=1')).toBe('/card/abc?x=1');
		expect(safeNext(null)).toBe('/');
		expect(safeNext('https://evil.example')).toBe('/');
		expect(safeNext('//evil.example')).toBe('/');
		expect(safeNext('/\\evil.example')).toBe('/');
	});
});

describe('requireUser', () => {
	it('returns the user or throws a 401', () => {
		const user = { id: 'u1', email: 'a@b.co' };
		expect(requireUser({ user } as App.Locals)).toBe(user);
		expect(() => requireUser({ user: null } as App.Locals)).toThrow();
	});
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npm run test:unit -- --run src/lib/server/auth.test.ts src/lib/server/routes.test.ts`
Expected: FAIL — cannot resolve `./auth` and `./routes`.

- [ ] **Step 7: Implement `src/lib/server/auth.ts`**

```ts
import { eq } from 'drizzle-orm';
import type { Db } from './db';
import { sessions, users } from './db/schema';
import { hashPassword, verifyPassword } from './password';
import { seedDefaultPiles } from './piles';

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionUser {
	id: string;
	email: string;
}

export class EmailTakenError extends Error {
	constructor() {
		super('An account with that email already exists');
		this.name = 'EmailTakenError';
	}
}

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export async function registerUser(db: Db, email: string, password: string): Promise<SessionUser> {
	const normalized = normalizeEmail(email);
	const [existing] = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, normalized))
		.limit(1);
	if (existing) throw new EmailTakenError();

	const [user] = await db
		.insert(users)
		.values({ email: normalized, password_hash: await hashPassword(password) })
		.returning({ id: users.id, email: users.email });
	await seedDefaultPiles(db, user.id);
	return user;
}

export async function authenticate(
	db: Db,
	email: string,
	password: string
): Promise<SessionUser | null> {
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.email, normalizeEmail(email)))
		.limit(1);
	if (!user) return null;
	return (await verifyPassword(password, user.password_hash))
		? { id: user.id, email: user.email }
		: null;
}

export async function createSession(db: Db, userId: string): Promise<string> {
	const [session] = await db
		.insert(sessions)
		.values({ user_id: userId, expires_at: new Date(Date.now() + SESSION_DURATION_MS) })
		.returning({ id: sessions.id });
	return session.id;
}

export async function validateSession(db: Db, sessionId: string): Promise<SessionUser | null> {
	const [row] = await db
		.select({ id: users.id, email: users.email, expires_at: sessions.expires_at })
		.from(sessions)
		.innerJoin(users, eq(sessions.user_id, users.id))
		.where(eq(sessions.id, sessionId))
		.limit(1);
	if (!row) return null;
	if (row.expires_at.getTime() <= Date.now()) {
		await deleteSession(db, sessionId);
		return null;
	}
	return { id: row.id, email: row.email };
}

export async function deleteSession(db: Db, sessionId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}
```

- [ ] **Step 8: Implement `src/lib/server/session-cookie.ts`**

```ts
import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { SESSION_DURATION_MS } from './auth';

export const SESSION_COOKIE_NAME = 'session';

export function setSessionCookie(cookies: Cookies, sessionId: string): void {
	cookies.set(SESSION_COOKIE_NAME, sessionId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: SESSION_DURATION_MS / 1000
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}
```

- [ ] **Step 9: Implement `src/lib/server/routes.ts`**

```ts
import { error } from '@sveltejs/kit';
import type { SessionUser } from './auth';

const PUBLIC_PATHS = new Set(['/login', '/signup', '/manifest.webmanifest', '/service-worker.js']);

export function isPublicPath(pathname: string): boolean {
	return PUBLIC_PATHS.has(pathname) || /^\/icons\/[\w.-]+$/.test(pathname);
}

/** Only same-site absolute paths survive; anything else sends you home. */
export function safeNext(next: string | null): string {
	if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
	return next;
}

export function requireUser(locals: App.Locals): SessionUser {
	if (!locals.user) error(401, 'Not signed in');
	return locals.user;
}
```

- [ ] **Step 10: Declare the app types** — replace `src/app.d.ts`

```ts
import type { D1Database } from '@cloudflare/workers-types';
import type { Db } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth';

declare global {
	namespace App {
		interface Locals {
			user: SessionUser | null;
			db: Db;
		}
		interface Platform {
			env: {
				DB: D1Database;
				ANTHROPIC_API_KEY: string;
			};
		}
	}
}

export {};
```

`D1Database` is imported as a type rather than added to `tsconfig` `types`, which would switch off the other ambient types (Node's, DOM's).

- [ ] **Step 11: Run all unit tests and the type check**

Run: `npm run test:unit -- --run && npm run check`
Expected: all PASS; 0 type errors.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add password hashing, users, sessions, and route guards"
```

---

### Task 5: Cards and the search index

**Files:**
- Create: `src/lib/server/search-index.ts`, `src/lib/server/cards.ts`
- Test: `src/lib/server/cards.test.ts`

**Interfaces:**
- Consumes: `Db`, `cards`, `subtasks`, `piles` (Task 2); `runSql`, `allSql` (Task 2); `getPile`, `listPiles`, `seedDefaultPiles`, `type Pile` (Task 3); `NotFoundError` (Task 3)
- Produces:
  - `reindexCard(db, cardId): Promise<void>`, `removeFromIndex(db, cardId): Promise<void>`
  - Types: `NewCard { title; notes: string | null; pileId; subtasks: string[] }`, `CardEdit { title; notes: string | null; pileId }`, `SubtaskInput { text; done: boolean }`, `Subtask { id; text; done }`, `CardSummary { id; title; created_at: Date }`, `PileWithCards extends Pile { cards: CardSummary[] }`, `CardDetail { id; title; notes: string | null; status: 'active' | 'done'; pile_id; pile_name; created_at: Date; done_at: Date | null; subtasks: Subtask[] }`, `ArchivedCard { id; title; pile_name; done_at: Date | null }`
  - `createCard(db, userId, input: NewCard): Promise<string>`
  - `getCard(db, userId, cardId): Promise<CardDetail | null>`
  - `updateCard(db, userId, cardId, edit: CardEdit): Promise<void>`
  - `setSubtasks(db, userId, cardId, items: SubtaskInput[]): Promise<void>` (replaces the whole list)
  - `markDone(db, userId, cardId)`, `reopenCard(db, userId, cardId)`, `deleteCard(db, userId, cardId)`: `Promise<void>`, each throwing `NotFoundError` for a missing or foreign card
  - `listActiveCardsByPile(db, userId): Promise<PileWithCards[]>` (every pile, including empty ones; cards newest first)
  - `listArchivedCards(db, userId): Promise<ArchivedCard[]>` (most recently done first)

- [ ] **Step 1: Write the failing tests** — `src/lib/server/cards.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import {
	createCard,
	deleteCard,
	getCard,
	listActiveCardsByPile,
	listArchivedCards,
	markDone,
	reopenCard,
	setSubtasks,
	updateCard
} from './cards';
import type { Db } from './db';
import { allSql } from './db/raw';
import { NotFoundError } from './errors';
import { listPiles, seedDefaultPiles, type Pile } from './piles';
import { createTestDb, createTestUser } from './test/db';

let db: Db;
let userId: string;
let house: Pile;
let ideas: Pile;

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

beforeEach(async () => {
	db = createTestDb();
	userId = await createTestUser(db);
	await seedDefaultPiles(db, userId);
	const piles = await listPiles(db, userId);
	house = piles[0];
	ideas = piles[2];
});

const newCard = (overrides: Partial<Parameters<typeof createCard>[2]> = {}) => ({
	title: 'Fix the gate latch',
	notes: null,
	pileId: house.id,
	subtasks: [],
	...overrides
});

describe('createCard and getCard', () => {
	it('stores a card with notes and ordered subtasks', async () => {
		const id = await createCard(
			db,
			userId,
			newCard({ notes: 'Side gate', subtasks: ['Buy latch', 'Install it'] })
		);
		const card = await getCard(db, userId, id);
		expect(card).toMatchObject({
			title: 'Fix the gate latch',
			notes: 'Side gate',
			status: 'active',
			pile_name: 'house',
			done_at: null
		});
		expect(card?.subtasks.map((s) => [s.text, s.done])).toEqual([
			['Buy latch', false],
			['Install it', false]
		]);
	});

	it("refuses another user's pile", async () => {
		const other = await createTestUser(db);
		await seedDefaultPiles(db, other);
		const [theirs] = await listPiles(db, other);
		await expect(createCard(db, userId, newCard({ pileId: theirs.id }))).rejects.toThrow(
			NotFoundError
		);
	});

	it("returns null for another user's card", async () => {
		const id = await createCard(db, userId, newCard());
		const other = await createTestUser(db);
		expect(await getCard(db, other, id)).toBeNull();
	});
});

describe('updateCard and setSubtasks', () => {
	it('edits the title, notes and pile', async () => {
		const id = await createCard(db, userId, newCard());
		await updateCard(db, userId, id, { title: 'Replace the gate', notes: 'Cedar', pileId: ideas.id });
		expect(await getCard(db, userId, id)).toMatchObject({
			title: 'Replace the gate',
			notes: 'Cedar',
			pile_name: 'ideas'
		});
	});

	it('replaces the subtask list', async () => {
		const id = await createCard(db, userId, newCard({ subtasks: ['old'] }));
		await setSubtasks(db, userId, id, [
			{ text: 'first', done: true },
			{ text: 'second', done: false }
		]);
		const card = await getCard(db, userId, id);
		expect(card?.subtasks.map((s) => [s.text, s.done])).toEqual([
			['first', true],
			['second', false]
		]);
	});

	it("changes nothing on another user's card", async () => {
		const id = await createCard(db, userId, newCard());
		const other = await createTestUser(db);
		await expect(
			updateCard(db, other, id, { title: 'hijacked', notes: null, pileId: house.id })
		).rejects.toThrow(NotFoundError);
		await expect(setSubtasks(db, other, id, [{ text: 'x', done: false }])).rejects.toThrow(
			NotFoundError
		);
		await expect(markDone(db, other, id)).rejects.toThrow(NotFoundError);
		await expect(deleteCard(db, other, id)).rejects.toThrow(NotFoundError);
		expect(await getCard(db, userId, id)).toMatchObject({ title: 'Fix the gate latch', status: 'active' });
	});
});

describe('done, reopen, delete', () => {
	it('archives a card and reopens it', async () => {
		const id = await createCard(db, userId, newCard());
		await markDone(db, userId, id);
		const done = await getCard(db, userId, id);
		expect(done?.status).toBe('done');
		expect(done?.done_at).toBeInstanceOf(Date);

		await reopenCard(db, userId, id);
		expect(await getCard(db, userId, id)).toMatchObject({ status: 'active', done_at: null });
	});

	it('deletes a card, its subtasks, and its index row', async () => {
		const id = await createCard(db, userId, newCard({ subtasks: ['a'] }));
		await deleteCard(db, userId, id);
		expect(await getCard(db, userId, id)).toBeNull();
		const indexed = await allSql(db, sql`SELECT card_id FROM cards_fts WHERE card_id = ${id}`);
		expect(indexed).toHaveLength(0);
	});
});

describe('listing', () => {
	it('groups active cards under every pile, newest first', async () => {
		const older = await createCard(db, userId, newCard({ title: 'older' }));
		await tick();
		const newer = await createCard(db, userId, newCard({ title: 'newer' }));
		const doneId = await createCard(db, userId, newCard({ title: 'finished' }));
		await markDone(db, userId, doneId);

		const grouped = await listActiveCardsByPile(db, userId);
		expect(grouped.map((p) => p.name)).toEqual([
			'house',
			'work stuff',
			'ideas',
			'video games',
			'model building'
		]);
		expect(grouped[0].cards.map((c) => c.id)).toEqual([newer, older]);
		expect(grouped[1].cards).toEqual([]);
	});

	it('lists archived cards, most recently done first', async () => {
		const a = await createCard(db, userId, newCard({ title: 'a' }));
		const b = await createCard(db, userId, newCard({ title: 'b' }));
		await markDone(db, userId, a);
		await tick();
		await markDone(db, userId, b);
		const archived = await listArchivedCards(db, userId);
		expect(archived.map((c) => [c.title, c.pile_name])).toEqual([
			['b', 'house'],
			['a', 'house']
		]);
	});
});

describe('search index maintenance', () => {
	it('indexes title, notes and subtasks, and follows edits', async () => {
		const id = await createCard(db, userId, newCard({ notes: 'cedar boards', subtasks: ['hinges'] }));
		type Row = { title: string; notes: string; subtasks: string; user_id: string };
		let [row] = await allSql<Row>(db, sql`SELECT * FROM cards_fts WHERE card_id = ${id}`);
		expect(row).toMatchObject({
			title: 'Fix the gate latch',
			notes: 'cedar boards',
			subtasks: 'hinges',
			user_id: userId
		});

		await updateCard(db, userId, id, { title: 'New title', notes: null, pileId: house.id });
		[row] = await allSql<Row>(db, sql`SELECT * FROM cards_fts WHERE card_id = ${id}`);
		expect(row.title).toBe('New title');
		expect(row.notes).toBe('');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --run src/lib/server/cards.test.ts`
Expected: FAIL — cannot resolve `./cards`.

- [ ] **Step 3: Implement `src/lib/server/search-index.ts`**

```ts
import { asc, eq, sql } from 'drizzle-orm';
import type { Db } from './db';
import { runSql } from './db/raw';
import { cards, subtasks } from './db/schema';

/** Rewrites a card's row in cards_fts from its current title, notes and subtasks. */
export async function reindexCard(db: Db, cardId: string): Promise<void> {
	await removeFromIndex(db, cardId);
	const [card] = await db
		.select({ id: cards.id, user_id: cards.user_id, title: cards.title, notes: cards.notes })
		.from(cards)
		.where(eq(cards.id, cardId))
		.limit(1);
	if (!card) return;

	const items = await db
		.select({ text: subtasks.text })
		.from(subtasks)
		.where(eq(subtasks.card_id, cardId))
		.orderBy(asc(subtasks.sort_order));
	await runSql(
		db,
		sql`INSERT INTO cards_fts (card_id, user_id, title, notes, subtasks)
			VALUES (${card.id}, ${card.user_id}, ${card.title}, ${card.notes ?? ''}, ${items.map((s) => s.text).join('\n')})`
	);
}

export async function removeFromIndex(db: Db, cardId: string): Promise<void> {
	await runSql(db, sql`DELETE FROM cards_fts WHERE card_id = ${cardId}`);
}
```

- [ ] **Step 4: Implement `src/lib/server/cards.ts`**

```ts
import { and, asc, desc, eq } from 'drizzle-orm';
import type { Db } from './db';
import { cards, piles, subtasks } from './db/schema';
import { NotFoundError } from './errors';
import { getPile, listPiles, type Pile } from './piles';
import { reindexCard, removeFromIndex } from './search-index';

export interface NewCard {
	title: string;
	notes: string | null;
	pileId: string;
	subtasks: string[];
}

export interface CardEdit {
	title: string;
	notes: string | null;
	pileId: string;
}

export interface SubtaskInput {
	text: string;
	done: boolean;
}

export interface Subtask {
	id: string;
	text: string;
	done: boolean;
}

export interface CardSummary {
	id: string;
	title: string;
	created_at: Date;
}

export interface PileWithCards extends Pile {
	cards: CardSummary[];
}

export interface CardDetail {
	id: string;
	title: string;
	notes: string | null;
	status: 'active' | 'done';
	pile_id: string;
	pile_name: string;
	created_at: Date;
	done_at: Date | null;
	subtasks: Subtask[];
}

export interface ArchivedCard {
	id: string;
	title: string;
	pile_name: string;
	done_at: Date | null;
}

const ownCard = (userId: string, cardId: string) =>
	and(eq(cards.id, cardId), eq(cards.user_id, userId));

async function requirePile(db: Db, userId: string, pileId: string): Promise<Pile> {
	const pile = await getPile(db, userId, pileId);
	if (!pile) throw new NotFoundError('pile');
	return pile;
}

async function requireCardId(db: Db, userId: string, cardId: string): Promise<void> {
	const [card] = await db.select({ id: cards.id }).from(cards).where(ownCard(userId, cardId)).limit(1);
	if (!card) throw new NotFoundError('card');
}

async function insertSubtasks(db: Db, cardId: string, items: SubtaskInput[]): Promise<void> {
	if (items.length === 0) return;
	await db
		.insert(subtasks)
		.values(items.map((item, i) => ({ card_id: cardId, text: item.text, done: item.done, sort_order: i })));
}

export async function createCard(db: Db, userId: string, input: NewCard): Promise<string> {
	const pile = await requirePile(db, userId, input.pileId);
	const [card] = await db
		.insert(cards)
		.values({ user_id: userId, pile_id: pile.id, title: input.title, notes: input.notes })
		.returning({ id: cards.id });
	await insertSubtasks(
		db,
		card.id,
		input.subtasks.map((text) => ({ text, done: false }))
	);
	await reindexCard(db, card.id);
	return card.id;
}

export async function getCard(db: Db, userId: string, cardId: string): Promise<CardDetail | null> {
	const [row] = await db
		.select({
			id: cards.id,
			title: cards.title,
			notes: cards.notes,
			status: cards.status,
			pile_id: cards.pile_id,
			pile_name: piles.name,
			created_at: cards.created_at,
			done_at: cards.done_at
		})
		.from(cards)
		.innerJoin(piles, eq(cards.pile_id, piles.id))
		.where(ownCard(userId, cardId))
		.limit(1);
	if (!row) return null;

	const items = await db
		.select({ id: subtasks.id, text: subtasks.text, done: subtasks.done })
		.from(subtasks)
		.where(eq(subtasks.card_id, cardId))
		.orderBy(asc(subtasks.sort_order));
	return { ...row, subtasks: items };
}

export async function updateCard(
	db: Db,
	userId: string,
	cardId: string,
	edit: CardEdit
): Promise<void> {
	await requireCardId(db, userId, cardId);
	const pile = await requirePile(db, userId, edit.pileId);
	await db
		.update(cards)
		.set({ title: edit.title, notes: edit.notes, pile_id: pile.id })
		.where(ownCard(userId, cardId));
	await reindexCard(db, cardId);
}

export async function setSubtasks(
	db: Db,
	userId: string,
	cardId: string,
	items: SubtaskInput[]
): Promise<void> {
	await requireCardId(db, userId, cardId);
	await db.delete(subtasks).where(eq(subtasks.card_id, cardId));
	await insertSubtasks(db, cardId, items);
	await reindexCard(db, cardId);
}

async function setStatus(
	db: Db,
	userId: string,
	cardId: string,
	status: 'active' | 'done'
): Promise<void> {
	const updated = await db
		.update(cards)
		.set({ status, done_at: status === 'done' ? new Date() : null })
		.where(ownCard(userId, cardId))
		.returning({ id: cards.id });
	if (updated.length === 0) throw new NotFoundError('card');
}

export const markDone = (db: Db, userId: string, cardId: string) =>
	setStatus(db, userId, cardId, 'done');

export const reopenCard = (db: Db, userId: string, cardId: string) =>
	setStatus(db, userId, cardId, 'active');

export async function deleteCard(db: Db, userId: string, cardId: string): Promise<void> {
	await requireCardId(db, userId, cardId);
	await removeFromIndex(db, cardId);
	await db.delete(subtasks).where(eq(subtasks.card_id, cardId));
	await db.delete(cards).where(ownCard(userId, cardId));
}

export async function listActiveCardsByPile(db: Db, userId: string): Promise<PileWithCards[]> {
	const pileList = await listPiles(db, userId);
	const active = await db
		.select({ id: cards.id, title: cards.title, pile_id: cards.pile_id, created_at: cards.created_at })
		.from(cards)
		.where(and(eq(cards.user_id, userId), eq(cards.status, 'active')))
		.orderBy(desc(cards.created_at));

	return pileList.map((pile) => ({
		...pile,
		cards: active
			.filter((card) => card.pile_id === pile.id)
			.map(({ id, title, created_at }) => ({ id, title, created_at }))
	}));
}

export async function listArchivedCards(db: Db, userId: string): Promise<ArchivedCard[]> {
	return db
		.select({ id: cards.id, title: cards.title, pile_name: piles.name, done_at: cards.done_at })
		.from(cards)
		.innerJoin(piles, eq(cards.pile_id, piles.id))
		.where(and(eq(cards.user_id, userId), eq(cards.status, 'done')))
		.orderBy(desc(cards.done_at));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:unit -- --run src/lib/server/cards.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/search-index.ts src/lib/server/cards.ts src/lib/server/cards.test.ts
git commit -m "feat: add cards with subtasks, done/reopen, and search indexing"
```

---

### Task 6: Search

**Files:**
- Create: `src/lib/server/search.ts`
- Test: `src/lib/server/search.test.ts`

**Interfaces:**
- Consumes: `allSql` (Task 2); `cards`, `piles` tables; `createCard`, `markDone` (Task 5); `seedDefaultPiles`, `listPiles` (Task 3)
- Produces:
  - `toFtsQuery(input: string): string | null` — every letter/number run becomes a quoted prefix term, ANDed; `null` when there is nothing searchable
  - `interface SearchResult { id: string; title: string; notes: string | null; status: 'active' | 'done'; pile_name: string }`
  - `searchCards(db, userId, input: string): Promise<SearchResult[]>` — best match first, at most 50

- [ ] **Step 1: Write the failing tests** — `src/lib/server/search.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createCard, markDone } from './cards';
import type { Db } from './db';
import { listPiles, seedDefaultPiles } from './piles';
import { searchCards, toFtsQuery } from './search';
import { createTestDb, createTestUser } from './test/db';

let db: Db;
let userId: string;
let pileId: string;

beforeEach(async () => {
	db = createTestDb();
	userId = await createTestUser(db);
	await seedDefaultPiles(db, userId);
	pileId = (await listPiles(db, userId))[4].id; // model building
});

const add = (title: string, notes: string | null = null, subtasks: string[] = []) =>
	createCard(db, userId, { title, notes, pileId, subtasks });

describe('toFtsQuery', () => {
	it('turns words into quoted prefix terms', () => {
		expect(toFtsQuery('X-wing paint')).toBe('"x"* "wing"* "paint"*');
	});

	it('neutralizes FTS5 syntax', () => {
		expect(toFtsQuery('"(AND* NEAR -')).toBe('"and"* "near"*');
		expect(toFtsQuery('  "*()-  ')).toBeNull();
	});
});

describe('searchCards', () => {
	it('matches title, notes, and subtasks, by word prefix', async () => {
		await add('Paint the X-wing');
		await add('Buy glue', 'for the TIE fighter');
		await add('Sand parts', null, ['primer coat']);
		await add('Unrelated');

		expect((await searchCards(db, userId, 'x-wing')).map((r) => r.title)).toEqual(['Paint the X-wing']);
		expect((await searchCards(db, userId, 'fight')).map((r) => r.title)).toEqual(['Buy glue']);
		expect((await searchCards(db, userId, 'primer')).map((r) => r.title)).toEqual(['Sand parts']);
	});

	it('finds archived cards and reports their status and pile', async () => {
		const id = await add('Varnish the base');
		await markDone(db, userId, id);
		expect(await searchCards(db, userId, 'varnish')).toEqual([
			expect.objectContaining({ id, status: 'done', pile_name: 'model building' })
		]);
	});

	it('returns an empty list for syntax-only or unmatched queries instead of throwing', async () => {
		await add('Paint the X-wing');
		for (const query of ['"', '*', '(', 'AND', 'NEAR(', '-', '""', 'zzz']) {
			await expect(searchCards(db, userId, query)).resolves.toEqual([]);
		}
	});

	it("never returns another user's cards", async () => {
		await add('Paint the X-wing');
		const other = await createTestUser(db);
		expect(await searchCards(db, other, 'paint')).toEqual([]);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --run src/lib/server/search.test.ts`
Expected: FAIL — cannot resolve `./search`.

- [ ] **Step 3: Implement** — `src/lib/server/search.ts`

```ts
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from './db';
import { allSql } from './db/raw';
import { cards, piles } from './db/schema';

const MAX_RESULTS = 50;

export interface SearchResult {
	id: string;
	title: string;
	notes: string | null;
	status: 'active' | 'done';
	pile_name: string;
}

/**
 * Builds an FTS5 query from free text. Only runs of letters and digits survive, each
 * quoted as a literal prefix term, so nothing typed can be read as FTS5 syntax.
 */
export function toFtsQuery(input: string): string | null {
	const terms = input.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
	if (terms.length === 0) return null;
	return terms.map((term) => `"${term}"*`).join(' ');
}

export async function searchCards(db: Db, userId: string, input: string): Promise<SearchResult[]> {
	const query = toFtsQuery(input);
	if (!query) return [];

	const hits = await allSql<{ card_id: string }>(
		db,
		sql`SELECT card_id FROM cards_fts
			WHERE cards_fts MATCH ${query} AND user_id = ${userId}
			ORDER BY rank LIMIT ${MAX_RESULTS}`
	);
	if (hits.length === 0) return [];

	const ids = hits.map((hit) => hit.card_id);
	const rows = await db
		.select({
			id: cards.id,
			title: cards.title,
			notes: cards.notes,
			status: cards.status,
			pile_name: piles.name
		})
		.from(cards)
		.innerJoin(piles, eq(cards.pile_id, piles.id))
		.where(and(eq(cards.user_id, userId), inArray(cards.id, ids)));

	// Keep FTS rank order.
	const byId = new Map(rows.map((row) => [row.id, row]));
	return ids.flatMap((id) => byId.get(id) ?? []);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --run src/lib/server/search.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/search.ts src/lib/server/search.test.ts
git commit -m "feat: add full-text card search that tolerates any input"
```

---

### Task 7: Claude parsing

**Files:**
- Create: `src/lib/types.ts`, `src/lib/server/parse/schema.ts`, `src/lib/server/parse/parse.ts`, `src/lib/server/parse/client.ts`, `src/lib/server/parse/fake-client.ts`
- Test: `src/lib/server/parse/parse.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure module; `parse.ts` uses only relative imports so `tsx` can run it in Task 15)
- Produces:
  - In `$lib/types`: `PileRef { id: string; name: string }`, `ParsedPile = { kind: 'existing'; id; name } | { kind: 'new'; name }`, `ParseResult { title: string; pile: ParsedPile | null; notes: string | null; subtasks: string[]; source: 'claude' | 'fallback' }`
  - In `parse/parse.ts`: constants `PARSE_MODEL`, `PARSE_TIMEOUT_MS`, `MAX_CAPTURE_LENGTH` (2000), `MAX_TITLE_LENGTH` (200), `MAX_NOTES_LENGTH` (5000), `MAX_PILE_NAME_LENGTH` (40), `MAX_PARSED_SUBTASKS` (20); `SYSTEM_PROMPT`; `buildParseRequest(text, pileNames)`; `interpretResponse(response, piles: PileRef[]): ParseResult | null`; `fallbackResult(text): ParseResult`; `parseCapture(client: Anthropic | null, text, piles: PileRef[]): Promise<ParseResult>` (never throws)
  - In `parse/client.ts`: `getParseClient(platformKey?: string): Anthropic | null`
  - In `parse/fake-client.ts`: `fakeParseClient(): Anthropic` — e2e only; text containing `[fail]` throws, `model|kit|paint` → `model building`, `game` → `video games`, anything else → new pile `garden`

- [ ] **Step 1: Write the shared types** — `src/lib/types.ts`

```ts
export interface PileRef {
	id: string;
	name: string;
}

export type ParsedPile = { kind: 'existing'; id: string; name: string } | { kind: 'new'; name: string };

export interface ParseResult {
	title: string;
	pile: ParsedPile | null;
	notes: string | null;
	subtasks: string[];
	source: 'claude' | 'fallback';
}
```

- [ ] **Step 2: Write the output schema** — `src/lib/server/parse/schema.ts`

```ts
import { z } from 'zod';

/** JSON Schema sent to Claude as the structured-output format. */
export const PARSE_JSON_SCHEMA: Record<string, unknown> = {
	type: 'object',
	properties: {
		title: { type: 'string', description: "A short, clear to-do in the user's own words" },
		pile: {
			type: 'string',
			description: 'The exact name of an existing pile, or a proposed new pile name'
		},
		isNewPile: { type: 'boolean', description: 'True only when proposing a new pile' },
		notes: { type: 'string', description: 'Extra detail from the text, or an empty string' },
		subtasks: {
			type: 'array',
			items: { type: 'string' },
			description: 'Steps or items the text explicitly lists, otherwise empty'
		}
	},
	required: ['title', 'pile', 'isNewPile', 'notes', 'subtasks'],
	additionalProperties: false
};

/** Runtime check of what came back, since a fallback model or bug could still send junk. */
export const parsedCardSchema = z.object({
	title: z.string(),
	pile: z.string(),
	isNewPile: z.boolean(),
	notes: z.string(),
	subtasks: z.array(z.string())
});
```

- [ ] **Step 3: Write the failing tests** — `src/lib/server/parse/parse.test.ts`

```ts
import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import type { PileRef } from '../../types';
import {
	MAX_TITLE_LENGTH,
	PARSE_MODEL,
	PARSE_TIMEOUT_MS,
	buildParseRequest,
	fallbackResult,
	interpretResponse,
	parseCapture
} from './parse';

const piles: PileRef[] = [
	{ id: 'p-house', name: 'house' },
	{ id: 'p-ideas', name: 'ideas' },
	{ id: 'p-models', name: 'model building' }
];

const reply = (body: unknown, stop_reason = 'end_turn') => ({
	stop_reason,
	content: [
		{ type: 'thinking', thinking: '' },
		{ type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) }
	]
});

const card = (overrides: Record<string, unknown> = {}) => ({
	title: 'Buy resin for the X-wing',
	pile: 'model building',
	isNewPile: false,
	notes: '',
	subtasks: [],
	...overrides
});

function clientReturning(result: Promise<unknown>) {
	const create = vi.fn().mockReturnValue(result);
	return { client: { beta: { messages: { create } } } as unknown as Anthropic, create };
}

describe('buildParseRequest', () => {
	it('asks the configured model for structured output with refusal fallbacks', () => {
		const request = buildParseRequest('get resin', ['house', 'ideas']);
		expect(request.model).toBe(PARSE_MODEL);
		expect(PARSE_MODEL).toBe('claude-opus-5-5');
		expect(request.output_config.effort).toBe('low');
		expect(request.output_config.format.type).toBe('json_schema');
		expect(request.fallbacks).toBe('default');
		expect(request.betas).toEqual(['server-side-fallback-2026-07-01']);
		expect(request.system).toContain('- house\n- ideas');
		expect(request.messages).toEqual([{ role: 'user', content: 'get resin' }]);
	});

	it('tells Claude the note is often dictated', () => {
		expect(buildParseRequest('get resin', ['house']).system).toMatch(/dictated/);
	});
});

describe('interpretResponse', () => {
	it('maps an existing pile to its id', () => {
		expect(interpretResponse(reply(card()), piles)).toEqual({
			title: 'Buy resin for the X-wing',
			pile: { kind: 'existing', id: 'p-models', name: 'model building' },
			notes: null,
			subtasks: [],
			source: 'claude'
		});
	});

	it('treats a case- or space-variant of an existing pile as that pile', () => {
		const result = interpretResponse(reply(card({ pile: ' Ideas ', isNewPile: true })), piles);
		expect(result?.pile).toEqual({ kind: 'existing', id: 'p-ideas', name: 'ideas' });
	});

	it('proposes a new pile, even when Claude forgot to flag it', () => {
		const result = interpretResponse(reply(card({ pile: 'garden', isNewPile: false })), piles);
		expect(result?.pile).toEqual({ kind: 'new', name: 'garden' });
	});

	it('keeps notes and trims, drops blank, and caps subtasks', () => {
		const many = Array.from({ length: 30 }, (_, i) => `step ${i}`);
		const result = interpretResponse(
			reply(card({ notes: '  gloss finish ', subtasks: [' sand ', '', ...many] })),
			piles
		);
		expect(result?.notes).toBe('gloss finish');
		expect(result?.subtasks[0]).toBe('sand');
		expect(result?.subtasks).toHaveLength(20);
	});

	it('returns null for a refusal, a truncated reply, invalid JSON, or the wrong shape', () => {
		expect(interpretResponse(reply(card(), 'refusal'), piles)).toBeNull();
		expect(interpretResponse(reply(card(), 'max_tokens'), piles)).toBeNull();
		expect(interpretResponse(reply('{not json'), piles)).toBeNull();
		expect(interpretResponse(reply({ title: 'x' }), piles)).toBeNull();
		expect(interpretResponse(reply(card({ title: '   ' })), piles)).toBeNull();
		expect(interpretResponse({ stop_reason: 'end_turn', content: [] }, piles)).toBeNull();
	});
});

describe('fallbackResult', () => {
	it('uses the raw text as the title with no pile', () => {
		expect(fallbackResult('  call the plumber ')).toEqual({
			title: 'call the plumber',
			pile: null,
			notes: null,
			subtasks: [],
			source: 'fallback'
		});
	});

	it('truncates a long capture and keeps the full text in notes', () => {
		const long = 'word '.repeat(100).trim(); // 499 chars
		const result = fallbackResult(long);
		expect(result.title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
		expect(result.title.endsWith('…')).toBe(true);
		expect(result.notes).toBe(long);
	});
});

describe('parseCapture', () => {
	it("returns Claude's card and passes the timeout with no retries", async () => {
		const { client, create } = clientReturning(Promise.resolve(reply(card())));
		const result = await parseCapture(client, 'get resin for the x-wing', piles);
		expect(result.source).toBe('claude');
		expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: PARSE_MODEL }), {
			timeout: PARSE_TIMEOUT_MS,
			maxRetries: 0
		});
	});

	it('falls back when the call throws (outage or timeout)', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = clientReturning(Promise.reject(new Error('Request timed out.')));
		expect(await parseCapture(client, 'call the plumber', piles)).toEqual(
			fallbackResult('call the plumber')
		);
	});

	it('falls back when the reply is unusable', async () => {
		const { client } = clientReturning(Promise.resolve(reply(card(), 'refusal')));
		expect((await parseCapture(client, 'call the plumber', piles)).source).toBe('fallback');
	});

	it('falls back without a client (no API key configured)', async () => {
		expect((await parseCapture(null, 'call the plumber', piles)).source).toBe('fallback');
	});
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm run test:unit -- --run src/lib/server/parse`
Expected: FAIL — cannot resolve `./parse`.

- [ ] **Step 5: Implement** — `src/lib/server/parse/parse.ts`

Note: imports stay relative (no `$lib`), so `scripts/smoke-parse.ts` can run this file under `tsx`.

```ts
import Anthropic from '@anthropic-ai/sdk';
import type { ParseResult, PileRef } from '../../types';
import { PARSE_JSON_SCHEMA, parsedCardSchema } from './schema';

export const PARSE_MODEL = 'claude-opus-5-5';
export const PARSE_TIMEOUT_MS = 5000;
export const MAX_CAPTURE_LENGTH = 2000;
export const MAX_TITLE_LENGTH = 200;
export const MAX_NOTES_LENGTH = 5000;
export const MAX_PILE_NAME_LENGTH = 40;
export const MAX_PARSED_SUBTASKS = 20;

export const SYSTEM_PROMPT = `You sort quick notes onto the user's piles, the way someone sorts 3x5 index cards. Each note is something they don't want to forget, usually a someday-task.

The note is often dictated rather than typed, so it may be run-on, lack punctuation, include filler ("um", "so I was thinking", "remind me to"), or contain a misheard word. Read it for what the user meant.

From the user's text, produce:
- title: the note as a short, clear to-do in the user's own words — the gist, not a transcript. Drop filler; fix only obvious typos and words that were clearly misheard. No trailing period.
- pile: the exact name of the best-fitting pile from the list below. Prefer an existing pile whenever it is a reasonable fit. Only if none fits, propose a short, lowercase new pile name and set isNewPile to true.
- notes: any extra useful detail that doesn't belong in the title (reasons, specifics, context), tidied but not embellished; otherwise an empty string.
- subtasks: only steps or items the text explicitly lists, otherwise an empty array.

Never invent details the user didn't write.`;

function clamp(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function buildParseRequest(text: string, pileNames: string[]) {
	return {
		model: PARSE_MODEL,
		max_tokens: 2048,
		betas: ['server-side-fallback-2026-07-01'],
		fallbacks: 'default' as const,
		output_config: {
			effort: 'low' as const,
			format: { type: 'json_schema' as const, schema: PARSE_JSON_SCHEMA }
		},
		system: `${SYSTEM_PROMPT}\n\nThe user's piles:\n${pileNames.map((name) => `- ${name}`).join('\n')}`,
		messages: [{ role: 'user' as const, content: text }]
	};
}

/** The two fields of a Messages API response this module reads. */
interface ParseResponse {
	stop_reason: string | null;
	content: Array<{ type: string; text?: unknown }>;
}

export function interpretResponse(response: ParseResponse, piles: PileRef[]): ParseResult | null {
	if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return null;

	const block = response.content.find((b) => b.type === 'text' && typeof b.text === 'string');
	if (!block) return null;

	let json: unknown;
	try {
		json = JSON.parse(block.text as string);
	} catch {
		return null;
	}
	const parsed = parsedCardSchema.safeParse(json);
	if (!parsed.success) return null;

	const title = parsed.data.title.trim();
	if (!title) return null;

	const pileName = parsed.data.pile.trim();
	const existing = piles.find((p) => p.name.toLowerCase() === pileName.toLowerCase());
	const pile = existing
		? ({ kind: 'existing', id: existing.id, name: existing.name } as const)
		: pileName
			? ({ kind: 'new', name: pileName.slice(0, MAX_PILE_NAME_LENGTH) } as const)
			: null;

	const notes = parsed.data.notes.trim();
	return {
		title: clamp(title, MAX_TITLE_LENGTH),
		pile,
		notes: notes ? notes.slice(0, MAX_NOTES_LENGTH) : null,
		subtasks: parsed.data.subtasks
			.map((s) => s.trim())
			.filter(Boolean)
			.slice(0, MAX_PARSED_SUBTASKS)
			.map((s) => clamp(s, MAX_TITLE_LENGTH)),
		source: 'claude'
	};
}

/** What the preview shows when Claude can't help: the raw text, no pile. */
export function fallbackResult(text: string): ParseResult {
	const trimmed = text.trim();
	const truncated = trimmed.length > MAX_TITLE_LENGTH;
	return {
		title: clamp(trimmed, MAX_TITLE_LENGTH),
		pile: null,
		notes: truncated ? trimmed.slice(0, MAX_NOTES_LENGTH) : null,
		subtasks: [],
		source: 'fallback'
	};
}

/** Never throws: any failure yields fallbackResult, so a capture is never lost. */
export async function parseCapture(
	client: Anthropic | null,
	text: string,
	piles: PileRef[]
): Promise<ParseResult> {
	if (!client) return fallbackResult(text);
	try {
		const response = await client.beta.messages.create(
			buildParseRequest(
				text,
				piles.map((p) => p.name)
			),
			{ timeout: PARSE_TIMEOUT_MS, maxRetries: 0 }
		);
		return interpretResponse(response, piles) ?? fallbackResult(text);
	} catch (error) {
		console.error(
			'[parse] Claude call failed:',
			error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error
		);
		return fallbackResult(text);
	}
}
```

If `npm run check` reports that `fallbacks` or the `betas` value is not assignable to the SDK's parameter type, the installed SDK predates the default-fallback beta: run `npm i @anthropic-ai/sdk@latest`. Do not cast these fields away.

- [ ] **Step 6: Implement the client factory** — `src/lib/server/parse/client.ts`

```ts
import Anthropic from '@anthropic-ai/sdk';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { fakeParseClient } from './fake-client';

/** The real Claude client, the e2e fake (dev + FAKE_CLAUDE=1), or null when no key is set. */
export function getParseClient(platformKey?: string): Anthropic | null {
	if (dev && env.FAKE_CLAUDE === '1') return fakeParseClient();
	const apiKey = platformKey || env.ANTHROPIC_API_KEY;
	return apiKey ? new Anthropic({ apiKey }) : null;
}
```

- [ ] **Step 7: Implement the e2e fake** — `src/lib/server/parse/fake-client.ts`

```ts
import type Anthropic from '@anthropic-ai/sdk';

/**
 * A deterministic stand-in for Claude, used only by the e2e suite (dev + FAKE_CLAUDE=1).
 * "[fail]" in the text simulates an outage.
 */
export function fakeParseClient(): Anthropic {
	const create = async (params: { messages: Array<{ content: string }> }) => {
		const text = params.messages[0].content;
		if (text.includes('[fail]')) throw new Error('fake Claude outage');

		const lower = text.toLowerCase();
		const pile = /model|kit|paint/.test(lower)
			? 'model building'
			: /game/.test(lower)
				? 'video games'
				: 'garden';
		const body = { title: text.trim(), pile, isNewPile: pile === 'garden', notes: '', subtasks: [] };
		return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(body) }] };
	};
	return { beta: { messages: { create } } } as unknown as Anthropic;
}
```

- [ ] **Step 8: Run tests and type check**

Run: `npm run test:unit -- --run src/lib/server/parse && npm run check`
Expected: all PASS; 0 type errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/types.ts src/lib/server/parse
git commit -m "feat: parse captures with Claude structured output, falling back on any failure"
```

---

### Task 8: Validation, saving a capture, and the JSON API

**Files:**
- Create: `src/lib/server/validation.ts`, `src/lib/server/capture.ts`, `src/routes/api/parse/+server.ts`, `src/routes/api/cards/+server.ts`, `src/hooks.server.ts`
- Test: `src/lib/server/validation.test.ts`, `src/lib/server/capture.test.ts`

**Interfaces:**
- Consumes: `createPile`, `listPiles`, `seedDefaultPiles` (Task 3); `createCard`, `getCard` (Task 5); `parseCapture`, `MAX_*` constants (Task 7); `getParseClient` (Task 7); `getDb` (Task 2); `validateSession`, `SESSION_COOKIE_NAME`, `isPublicPath`, `requireUser` (Task 4); `NotFoundError` (Task 3)
- Produces:
  - Zod schemas: `credentialsSchema`, `titleSchema`, `notesSchema`, `subtasksSchema`, `pileNameSchema`, `captureSaveSchema`, `cardEditSchema`; type `CaptureSave = z.infer<typeof captureSaveSchema>`
  - `saveCapture(db, userId, input: CaptureSave): Promise<string>`
  - `POST /api/parse` `{ text }` → `ParseResult` (400 on empty/over-long text, 401 signed out)
  - `POST /api/cards` `{ title, notes, subtasks, pile: { kind: 'existing', id } | { kind: 'new', name } }` → `201 { id }` (400 invalid, 404 foreign pile)
  - `hooks.server.ts`: sets `locals.db` and `locals.user`; redirects signed-out page requests to `/login?next=…`; returns `401` JSON for signed-out `/api/*`

- [ ] **Step 1: Write the failing tests**

`src/lib/server/validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { captureSaveSchema, credentialsSchema, subtasksSchema } from './validation';

describe('credentialsSchema', () => {
	it('normalizes email and requires 8+ character passwords', () => {
		expect(credentialsSchema.parse({ email: ' Me@Example.com ', password: '12345678' })).toEqual({
			email: 'me@example.com',
			password: '12345678'
		});
		expect(credentialsSchema.safeParse({ email: 'nope', password: '12345678' }).success).toBe(false);
		expect(credentialsSchema.safeParse({ email: 'me@example.com', password: 'short' }).success).toBe(false);
	});
});

describe('subtasksSchema', () => {
	it('trims and drops blank items', () => {
		expect(subtasksSchema.parse([' a ', '', '  ', 'b'])).toEqual(['a', 'b']);
	});

	it('rejects more than 50 items', () => {
		expect(subtasksSchema.safeParse(Array.from({ length: 51 }, () => 'x')).success).toBe(false);
	});
});

describe('captureSaveSchema', () => {
	const base = { title: ' Paint the X-wing ', notes: '', subtasks: [] };

	it('accepts an existing or a new pile and normalizes empty notes to null', () => {
		expect(
			captureSaveSchema.parse({ ...base, pile: { kind: 'existing', id: 'p1' } })
		).toEqual({ title: 'Paint the X-wing', notes: null, subtasks: [], pile: { kind: 'existing', id: 'p1' } });
		expect(
			captureSaveSchema.parse({ ...base, pile: { kind: 'new', name: ' garden ' } }).pile
		).toEqual({ kind: 'new', name: 'garden' });
	});

	it('rejects an empty title, a missing pile, and over-long fields', () => {
		expect(captureSaveSchema.safeParse({ ...base, title: '  ', pile: { kind: 'existing', id: 'p1' } }).success).toBe(false);
		expect(captureSaveSchema.safeParse(base).success).toBe(false);
		expect(captureSaveSchema.safeParse({ ...base, title: 'x'.repeat(201), pile: { kind: 'existing', id: 'p1' } }).success).toBe(false);
		expect(captureSaveSchema.safeParse({ ...base, pile: { kind: 'new', name: 'x'.repeat(41) } }).success).toBe(false);
	});
});
```

`src/lib/server/capture.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { saveCapture } from './capture';
import { getCard } from './cards';
import type { Db } from './db';
import { NotFoundError } from './errors';
import { listPiles, seedDefaultPiles } from './piles';
import { createTestDb, createTestUser } from './test/db';

let db: Db;
let userId: string;

beforeEach(async () => {
	db = createTestDb();
	userId = await createTestUser(db);
	await seedDefaultPiles(db, userId);
});

const capture = { title: 'Plant tomatoes', notes: null, subtasks: ['Buy seedlings'] };

describe('saveCapture', () => {
	it('files the card on an existing pile', async () => {
		const [house] = await listPiles(db, userId);
		const id = await saveCapture(db, userId, { ...capture, pile: { kind: 'existing', id: house.id } });
		expect(await getCard(db, userId, id)).toMatchObject({ title: 'Plant tomatoes', pile_name: 'house' });
	});

	it('creates an accepted new pile and files the card there', async () => {
		const id = await saveCapture(db, userId, { ...capture, pile: { kind: 'new', name: 'garden' } });
		expect((await getCard(db, userId, id))?.pile_name).toBe('garden');
		expect((await listPiles(db, userId)).map((p) => p.name)).toContain('garden');
	});

	it('reuses an existing pile when the "new" name only differs by case', async () => {
		await saveCapture(db, userId, { ...capture, pile: { kind: 'new', name: 'IDEAS' } });
		expect(await listPiles(db, userId)).toHaveLength(5);
	});

	it("rejects another user's pile", async () => {
		const other = await createTestUser(db);
		await seedDefaultPiles(db, other);
		const [theirs] = await listPiles(db, other);
		await expect(
			saveCapture(db, userId, { ...capture, pile: { kind: 'existing', id: theirs.id } })
		).rejects.toThrow(NotFoundError);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --run src/lib/server/validation.test.ts src/lib/server/capture.test.ts`
Expected: FAIL — cannot resolve `./validation` and `./capture`.

- [ ] **Step 3: Implement `src/lib/server/validation.ts`**

```ts
import { z } from 'zod';
import { MAX_NOTES_LENGTH, MAX_PILE_NAME_LENGTH, MAX_TITLE_LENGTH } from './parse/parse';

export const MAX_SUBTASKS = 50;

export const credentialsSchema = z.object({
	email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
	password: z
		.string()
		.min(8, 'Password must be at least 8 characters')
		.max(200, 'Password is too long')
});

export const titleSchema = z
	.string()
	.trim()
	.min(1, 'Title is required')
	.max(MAX_TITLE_LENGTH, `Title must be ${MAX_TITLE_LENGTH} characters or fewer`);

export const notesSchema = z
	.string()
	.trim()
	.max(MAX_NOTES_LENGTH, `Notes must be ${MAX_NOTES_LENGTH} characters or fewer`)
	.nullish()
	.transform((value) => (value ? value : null));

export const subtasksSchema = z
	.array(z.string())
	.max(MAX_SUBTASKS, `A card can have at most ${MAX_SUBTASKS} subtasks`)
	.transform((items) => items.map((item) => item.trim()).filter((item) => item.length > 0))
	.pipe(z.array(z.string().max(MAX_TITLE_LENGTH, 'Subtasks must be 200 characters or fewer')));

export const pileNameSchema = z
	.string()
	.trim()
	.min(1, 'Pile name is required')
	.max(MAX_PILE_NAME_LENGTH, `Pile names must be ${MAX_PILE_NAME_LENGTH} characters or fewer`);

export const captureSaveSchema = z.object({
	title: titleSchema,
	notes: notesSchema,
	subtasks: subtasksSchema,
	pile: z.discriminatedUnion('kind', [
		z.object({ kind: z.literal('existing'), id: z.string().min(1) }),
		z.object({ kind: z.literal('new'), name: pileNameSchema })
	])
});

export type CaptureSave = z.infer<typeof captureSaveSchema>;

export const cardEditSchema = z.object({
	title: titleSchema,
	notes: notesSchema,
	pileId: z.string().min(1, 'Choose a pile')
});
```

- [ ] **Step 4: Implement `src/lib/server/capture.ts`**

```ts
import { createCard } from './cards';
import type { Db } from './db';
import { createPile } from './piles';
import type { CaptureSave } from './validation';

/** Saves a confirmed preview, creating the pile first if the user accepted a new one. */
export async function saveCapture(db: Db, userId: string, input: CaptureSave): Promise<string> {
	const pileId =
		input.pile.kind === 'existing' ? input.pile.id : (await createPile(db, userId, input.pile.name)).id;
	return createCard(db, userId, {
		title: input.title,
		notes: input.notes,
		pileId,
		subtasks: input.subtasks
	});
}
```

- [ ] **Step 5: Run the unit tests to verify they pass**

Run: `npm run test:unit -- --run src/lib/server/validation.test.ts src/lib/server/capture.test.ts`
Expected: all PASS.

- [ ] **Step 6: Write `src/hooks.server.ts`**

```ts
import { json, redirect, type Handle } from '@sveltejs/kit';
import { validateSession } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { isPublicPath } from '$lib/server/routes';
import { SESSION_COOKIE_NAME } from '$lib/server/session-cookie';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.db = await getDb(event.platform?.env?.DB);

	const sessionId = event.cookies.get(SESSION_COOKIE_NAME);
	event.locals.user = sessionId ? await validateSession(event.locals.db, sessionId) : null;

	// Gate everything by default, so a new route is protected without remembering to opt in.
	if (!event.locals.user && !isPublicPath(event.url.pathname)) {
		if (event.url.pathname.startsWith('/api/')) {
			return json({ error: 'Not signed in' }, { status: 401 });
		}
		redirect(303, `/login?next=${encodeURIComponent(event.url.pathname + event.url.search)}`);
	}

	return resolve(event);
};
```

- [ ] **Step 7: Write `src/routes/api/parse/+server.ts`**

```ts
import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getParseClient } from '$lib/server/parse/client';
import { MAX_CAPTURE_LENGTH, parseCapture } from '$lib/server/parse/parse';
import { listPiles } from '$lib/server/piles';
import { requireUser } from '$lib/server/routes';
import type { RequestHandler } from './$types';

const bodySchema = z.object({ text: z.string().trim().min(1).max(MAX_CAPTURE_LENGTH) });

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const user = requireUser(locals);
	const body = bodySchema.safeParse(await request.json().catch(() => null));
	if (!body.success) error(400, `Text must be 1–${MAX_CAPTURE_LENGTH} characters`);

	const piles = await listPiles(locals.db, user.id);
	const client = getParseClient(platform?.env?.ANTHROPIC_API_KEY);
	return json(await parseCapture(client, body.data.text, piles));
};
```

- [ ] **Step 8: Write `src/routes/api/cards/+server.ts`**

```ts
import { error, json } from '@sveltejs/kit';
import { saveCapture } from '$lib/server/capture';
import { NotFoundError } from '$lib/server/errors';
import { requireUser } from '$lib/server/routes';
import { captureSaveSchema } from '$lib/server/validation';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireUser(locals);
	const body = captureSaveSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) error(400, body.error.issues[0]?.message ?? 'Invalid card');

	try {
		const id = await saveCapture(locals.db, user.id, body.data);
		return json({ id }, { status: 201 });
	} catch (e) {
		if (e instanceof NotFoundError) error(404, 'Pile not found');
		throw e;
	}
};
```

- [ ] **Step 9: Run all unit tests and the type check**

Run: `npm run test:unit -- --run && npm run check`
Expected: all PASS; 0 type errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add capture validation, save service, JSON API, and auth gate"
```

---

### Task 9: Sign up, log in, log out, and the app shell

**Files:**
- Create: `src/routes/+layout.server.ts`, `src/routes/signup/+page.svelte`, `src/routes/signup/+page.server.ts`, `src/routes/login/+page.svelte`, `src/routes/login/+page.server.ts`, `src/routes/logout/+page.server.ts`, `e2e/helpers.ts`
- Modify: `src/routes/+layout.svelte`, `src/routes/layout.css`, `src/routes/+page.svelte` (temporary placeholder, replaced in Task 10)
- Test: `e2e/auth.test.ts`

**Interfaces:**
- Consumes: `registerUser`, `authenticate`, `createSession`, `deleteSession`, `EmailTakenError` (Task 4); `setSessionCookie`, `clearSessionCookie`, `SESSION_COOKIE_NAME` (Task 4); `safeNext` (Task 4); `credentialsSchema` (Task 8)
- Produces:
  - Pages `/signup`, `/login` (honours `?next=`), action `POST /logout`
  - Layout data `{ user: { email } | null }`; nav with links **Piles**, **Search**, **Archive**, **Manage piles**, and a **Log out** button (hidden on `/quick-add` and when signed out)
  - `e2e/helpers.ts`: `signUp(page): Promise<string>` (returns the email; lands on `/`)

- [ ] **Step 1: Write the e2e helper and failing auth tests**

`e2e/helpers.ts`:

```ts
import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'correct horse battery';

export async function signUp(page: Page): Promise<string> {
	const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.dev`;
	await page.goto('/signup');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	return email;
}
```

`e2e/auth.test.ts`:

```ts
import { expect, test } from '@playwright/test';
import { PASSWORD, signUp } from './helpers';

test('signing up lands on the piles page', async ({ page }) => {
	await signUp(page);
	await expect(page.getByRole('link', { name: 'Manage piles' })).toBeVisible();
});

test('a signed-out visitor is sent to log in, then back where they were going', async ({ page }) => {
	const email = await signUp(page);
	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page).toHaveURL('/login');

	await page.goto('/search?q=paint');
	await expect(page).toHaveURL(/\/login\?next=%2Fsearch%3Fq%3Dpaint/);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page).toHaveURL('/search?q=paint');
});

test('a wrong password shows an error', async ({ page }) => {
	const email = await signUp(page);
	await page.getByRole('button', { name: 'Log out' }).click();
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('not the password');
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page.getByRole('alert')).toHaveText('Wrong email or password');
});

test('signing up twice with one email is refused', async ({ page }) => {
	const email = await signUp(page);
	await page.getByRole('button', { name: 'Log out' }).click();
	await page.goto('/signup');
	await page.getByLabel('Email').fill(email.toUpperCase());
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByRole('alert')).toHaveText('An account with that email already exists');
});

test('the API refuses signed-out requests', async ({ request }) => {
	const response = await request.post('/api/parse', { data: { text: 'hello' } });
	expect(response.status()).toBe(401);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test:e2e -- e2e/auth.test.ts`
Expected: FAIL — `/signup` returns 404.

- [ ] **Step 3: Write `src/routes/layout.css`** (replace what sv generated; if sv put the Tailwind import in `src/app.css` instead, delete that file and its import)

```css
@import 'tailwindcss';
@plugin '@tailwindcss/forms';

html,
body {
	background: var(--color-stone-50);
	color: var(--color-stone-900);
}
```

- [ ] **Step 4: Write `src/routes/+layout.server.ts` and replace `src/routes/+layout.svelte`**

```ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	user: locals.user ? { email: locals.user.email } : null
});
```

```svelte
<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';

	let { data, children } = $props();

	const links = [
		{ href: '/', label: 'Piles' },
		{ href: '/search', label: 'Search' },
		{ href: '/archive', label: 'Archive' },
		{ href: '/piles', label: 'Manage piles' }
	];
</script>

<svelte:head>
	<title>butterfly-net</title>
</svelte:head>

{#if data.user && page.url.pathname !== '/quick-add'}
	<header class="border-b border-stone-200 bg-white">
		<nav class="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
			<a href="/" class="font-semibold text-teal-800">🦋 butterfly-net</a>
			{#each links as link (link.href)}
				<a
					href={link.href}
					class="text-sm text-stone-600 hover:text-stone-900 aria-[current=page]:font-semibold aria-[current=page]:text-stone-900"
					aria-current={page.url.pathname === link.href ? 'page' : undefined}>{link.label}</a
				>
			{/each}
			<form method="POST" action="/logout" class="ml-auto">
				<button class="text-sm text-stone-600 hover:text-stone-900">Log out</button>
			</form>
		</nav>
	</header>
{/if}

<main class="mx-auto max-w-5xl px-4 py-6">
	{@render children()}
</main>
```

Replace `src/routes/+page.svelte` with a placeholder so `/` renders until Task 10:

```svelte
<h1 class="text-xl font-semibold">Your piles</h1>
```

- [ ] **Step 5: Write the sign-up route**

`src/routes/signup/+page.server.ts`:

```ts
import { fail, redirect } from '@sveltejs/kit';
import { EmailTakenError, createSession, registerUser } from '$lib/server/auth';
import { setSessionCookie } from '$lib/server/session-cookie';
import { credentialsSchema } from '$lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const parsed = credentialsSchema.safeParse({ email, password: form.get('password') });
		if (!parsed.success) return fail(400, { email, error: parsed.error.issues[0].message });

		try {
			const user = await registerUser(locals.db, parsed.data.email, parsed.data.password);
			setSessionCookie(cookies, await createSession(locals.db, user.id));
		} catch (e) {
			if (e instanceof EmailTakenError) return fail(400, { email, error: e.message });
			throw e;
		}
		redirect(303, '/');
	}
};
```

`src/routes/signup/+page.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<div class="mx-auto mt-12 max-w-sm">
	<h1 class="mb-1 text-2xl font-semibold">Create your account</h1>
	<p class="mb-6 text-sm text-stone-600">Catch your thoughts before they flutter away.</p>
	<form method="POST" use:enhance class="space-y-4">
		<div>
			<label for="email" class="block text-sm font-medium">Email</label>
			<input id="email" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} class="mt-1 w-full rounded-md border-stone-300" />
		</div>
		<div>
			<label for="password" class="block text-sm font-medium">Password</label>
			<input id="password" name="password" type="password" autocomplete="new-password" minlength="8" required class="mt-1 w-full rounded-md border-stone-300" />
		</div>
		{#if form?.error}<p role="alert" class="text-sm text-red-700">{form.error}</p>{/if}
		<button class="w-full rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800">Create account</button>
	</form>
	<p class="mt-4 text-sm">Already have an account? <a href="/login" class="text-teal-800 underline">Log in</a></p>
</div>
```

- [ ] **Step 6: Write the log-in route**

`src/routes/login/+page.server.ts`:

```ts
import { fail, redirect } from '@sveltejs/kit';
import { authenticate, createSession } from '$lib/server/auth';
import { safeNext } from '$lib/server/routes';
import { setSessionCookie } from '$lib/server/session-cookie';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
};

export const actions: Actions = {
	default: async ({ request, locals, cookies, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const user = await authenticate(locals.db, email, String(form.get('password') ?? ''));
		if (!user) return fail(400, { email, error: 'Wrong email or password' });

		setSessionCookie(cookies, await createSession(locals.db, user.id));
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
```

`src/routes/login/+page.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<div class="mx-auto mt-12 max-w-sm">
	<h1 class="mb-6 text-2xl font-semibold">Log in</h1>
	<form method="POST" use:enhance class="space-y-4">
		<div>
			<label for="email" class="block text-sm font-medium">Email</label>
			<input id="email" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} class="mt-1 w-full rounded-md border-stone-300" />
		</div>
		<div>
			<label for="password" class="block text-sm font-medium">Password</label>
			<input id="password" name="password" type="password" autocomplete="current-password" required class="mt-1 w-full rounded-md border-stone-300" />
		</div>
		{#if form?.error}<p role="alert" class="text-sm text-red-700">{form.error}</p>{/if}
		<button class="w-full rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800">Log in</button>
	</form>
	<p class="mt-4 text-sm">New here? <a href="/signup" class="text-teal-800 underline">Create an account</a></p>
</div>
```

A form without an `action` attribute posts to the current URL, so `?next=` reaches the action.

- [ ] **Step 7: Write the log-out action** — `src/routes/logout/+page.server.ts`

```ts
import { redirect } from '@sveltejs/kit';
import { deleteSession } from '$lib/server/auth';
import { SESSION_COOKIE_NAME, clearSessionCookie } from '$lib/server/session-cookie';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	default: async ({ locals, cookies }) => {
		const sessionId = cookies.get(SESSION_COOKIE_NAME);
		if (sessionId) await deleteSession(locals.db, sessionId);
		clearSessionCookie(cookies);
		redirect(303, '/login');
	}
};
```

- [ ] **Step 8: Run the e2e tests to verify they pass**

Run: `npm run test:e2e -- e2e/auth.test.ts`
Expected: 5 PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add sign up, log in, log out, and the app shell"
```

---

### Task 10: Capture, the piles view, and quick-add

**Files:**
- Create: `src/lib/components/CaptureBox.svelte`, `src/routes/+page.server.ts`, `src/routes/quick-add/+page.svelte`, `src/routes/quick-add/+page.server.ts`
- Modify: `src/routes/+page.svelte` (replace the Task 9 placeholder), `e2e/helpers.ts`
- Test: `e2e/capture.test.ts`

**Interfaces:**
- Consumes: `POST /api/parse`, `POST /api/cards` (Task 8); `listActiveCardsByPile`, `markDone`, `reopenCard` (Task 5); `listPiles` (Task 3); `requireUser` (Task 4); `NotFoundError`; `PileRef`, `ParseResult` (Task 7); `signUp` (Task 9)
- Produces:
  - `<CaptureBox piles={PileRef[]} onSaved={() => void | Promise<void>} autofocus={boolean} />` with an exported `focus()` method. Accessible names used by tests: textarea label **Catch a thought**, button **Catch**, status **Caught ✓**, preview form **Card preview** with fields **Title**, **Pile**, **Notes**, button **Save** / **Cancel**
  - `/` — capture box plus one `region` per pile, named by the pile; each card has a button **Mark "<title>" done**; an undo toast **Done: <title>** with **Undo**; pressing `n` focuses the capture box
  - Actions `?/done`, `?/reopen` on `/` (form field `id`)
  - `/quick-add` — capture box only
  - `e2e/helpers.ts`: `capture(page, text, pile?)` (confirms the preview, waits for **Caught ✓**)

- [ ] **Step 1: Add the `capture` helper to `e2e/helpers.ts`**

```ts
export async function capture(page: Page, text: string, pile?: string): Promise<void> {
	await page.getByLabel('Catch a thought').fill(text);
	await page.getByRole('button', { name: 'Catch' }).click();
	const preview = page.getByRole('form', { name: 'Card preview' });
	await expect(preview).toBeVisible();
	if (pile) await preview.getByLabel('Pile').selectOption({ label: pile });
	await preview.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Caught ✓' })).toBeVisible();
}
```

- [ ] **Step 2: Write the failing e2e tests** — `e2e/capture.test.ts`

The fake Claude (Task 7) files "model/kit/paint" under **model building**, "game" under **video games**, proposes a new **garden** pile for anything else, and fails on `[fail]`.

```ts
import { expect, test } from '@playwright/test';
import { capture, signUp } from './helpers';

test.beforeEach(async ({ page }) => {
	await signUp(page);
});

test('shows the five default piles', async ({ page }) => {
	for (const name of ['house', 'work stuff', 'ideas', 'video games', 'model building']) {
		await expect(page.getByRole('region', { name })).toBeVisible();
	}
});

test("Claude's pile is preselected, and the card lands on it", async ({ page }) => {
	await page.getByLabel('Catch a thought').fill('Paint the X-wing canopy');
	await page.getByRole('button', { name: 'Catch' }).click();
	const preview = page.getByRole('form', { name: 'Card preview' });
	await expect(preview.getByLabel('Title')).toHaveValue('Paint the X-wing canopy');
	await expect(preview.getByLabel('Pile').locator('option:checked')).toHaveText('model building');
	await preview.getByRole('button', { name: 'Save' }).click();

	await expect(page.getByRole('status').filter({ hasText: 'Caught ✓' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'model building' })).toContainText('Paint the X-wing canopy');
});

test('accepting a proposed new pile creates it', async ({ page }) => {
	await page.getByLabel('Catch a thought').fill('Plant tomatoes');
	await page.getByRole('button', { name: 'Catch' }).click();
	const preview = page.getByRole('form', { name: 'Card preview' });
	await expect(preview.getByLabel('Pile').locator('option:checked')).toHaveText('✨ New pile: garden');
	await preview.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('region', { name: 'garden' })).toContainText('Plant tomatoes');
});

test('when Claude is down, the thought is still caught', async ({ page }) => {
	await page.getByLabel('Catch a thought').fill('[fail] Call the plumber');
	await page.getByRole('button', { name: 'Catch' }).click();
	const preview = page.getByRole('form', { name: 'Card preview' });
	await expect(preview.getByRole('status')).toContainText("Couldn't sort this one automatically");
	await expect(preview.getByRole('button', { name: 'Save' })).toBeDisabled();
	await preview.getByLabel('Pile').selectOption({ label: 'house' });
	await preview.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('region', { name: 'house' })).toContainText('[fail] Call the plumber');
});

test('cancel returns to the text without saving', async ({ page }) => {
	await page.getByLabel('Catch a thought').fill('Paint the TIE fighter');
	await page.getByRole('button', { name: 'Catch' }).click();
	await page.getByRole('button', { name: 'Cancel' }).click();
	await expect(page.getByLabel('Catch a thought')).toHaveValue('Paint the TIE fighter');
	await expect(page.getByRole('region', { name: 'model building' })).not.toContainText('TIE fighter');
});

test('marking a card done can be undone', async ({ page }) => {
	await capture(page, 'Paint the Y-wing');
	const pile = page.getByRole('region', { name: 'model building' });
	await pile.getByRole('button', { name: 'Mark "Paint the Y-wing" done' }).click();
	await expect(pile).not.toContainText('Paint the Y-wing');
	await expect(page.getByRole('status').filter({ hasText: 'Done: Paint the Y-wing' })).toBeVisible();
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(pile).toContainText('Paint the Y-wing');
});

test('pressing n focuses the capture box', async ({ page }) => {
	await page.locator('body').click();
	await page.keyboard.press('n');
	await expect(page.getByLabel('Catch a thought')).toBeFocused();
});

test('quick-add catches a thought and stays ready for the next', async ({ page }) => {
	await page.goto('/quick-add');
	await expect(page.getByRole('link', { name: 'Manage piles' })).toHaveCount(0);
	await capture(page, 'Beat the next game level');
	await expect(page.getByLabel('Catch a thought')).toHaveValue('');
	await page.goto('/');
	await expect(page.getByRole('region', { name: 'video games' })).toContainText('Beat the next game level');
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npm run test:e2e -- e2e/capture.test.ts`
Expected: FAIL — no `region` named `house` (the page is still the placeholder).

- [ ] **Step 4: Write `src/lib/components/CaptureBox.svelte`**

```svelte
<script lang="ts">
	import type { ParseResult, PileRef } from '$lib/types';

	interface Props {
		piles: PileRef[];
		onSaved?: () => void | Promise<void>;
		autofocus?: boolean;
	}

	let { piles, onSaved, autofocus = false }: Props = $props();

	const MAX_TITLE = 200;

	let phase = $state<'input' | 'parsing' | 'preview' | 'saving'>('input');
	let text = $state('');
	let title = $state('');
	let notes = $state('');
	let subtasks = $state<string[]>([]);
	// A pile id, `new:<name>` for a proposed pile, or '' until chosen.
	let pileChoice = $state('');
	let proposedPile = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let caught = $state(false);
	let textInput = $state<HTMLTextAreaElement>();
	let titleInput = $state<HTMLInputElement>();

	export function focus() {
		textInput?.focus();
	}

	$effect(() => {
		if (autofocus) textInput?.focus();
	});

	$effect(() => {
		if (phase === 'preview') titleInput?.focus();
	});

	// Mirrors the server's fallback for when /api/parse itself is unreachable.
	function localFallback(raw: string): ParseResult {
		const long = raw.length > MAX_TITLE;
		return {
			title: long ? `${raw.slice(0, MAX_TITLE - 1).trimEnd()}…` : raw,
			pile: null,
			notes: long ? raw : null,
			subtasks: [],
			source: 'fallback'
		};
	}

	function showPreview(result: ParseResult) {
		title = result.title;
		notes = result.notes ?? '';
		subtasks = [...result.subtasks];
		proposedPile = result.pile?.kind === 'new' ? result.pile.name : null;
		pileChoice =
			result.pile?.kind === 'existing'
				? result.pile.id
				: result.pile?.kind === 'new'
					? `new:${result.pile.name}`
					: '';
		notice = result.source === 'fallback' ? "Couldn't sort this one automatically — pick a pile." : null;
		phase = 'preview';
	}

	async function parse(event: SubmitEvent) {
		event.preventDefault();
		const raw = text.trim();
		if (!raw || phase !== 'input') return;
		phase = 'parsing';
		caught = false;
		try {
			const response = await fetch('/api/parse', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text: raw })
			});
			if (!response.ok) throw new Error(`parse failed: ${response.status}`);
			showPreview(await response.json());
		} catch {
			showPreview(localFallback(raw));
		}
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (phase !== 'preview' || !pileChoice || !title.trim()) return;
		phase = 'saving';
		const pile = pileChoice.startsWith('new:')
			? { kind: 'new', name: pileChoice.slice(4) }
			: { kind: 'existing', id: pileChoice };
		try {
			const response = await fetch('/api/cards', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ title, notes: notes || null, subtasks, pile })
			});
			if (!response.ok) throw new Error(`save failed: ${response.status}`);
		} catch {
			notice = "Couldn't save — check your connection and try again.";
			phase = 'preview';
			return;
		}
		reset();
		caught = true;
		await onSaved?.();
		textInput?.focus();
	}

	function reset() {
		text = '';
		title = '';
		notes = '';
		subtasks = [];
		pileChoice = '';
		proposedPile = null;
		notice = null;
		phase = 'input';
	}

	function cancel() {
		phase = 'input';
		notice = null;
		queueMicrotask(() => textInput?.focus());
	}

	function submitOnEnter(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			(event.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
		}
	}

	function cancelOnEscape(event: KeyboardEvent) {
		if (event.key === 'Escape') cancel();
	}
</script>

<div class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
	{#if phase === 'input' || phase === 'parsing'}
		<form onsubmit={parse}>
			<label for="capture-text" class="sr-only">Catch a thought</label>
			<textarea
				id="capture-text"
				bind:this={textInput}
				bind:value={text}
				oninput={() => (caught = false)}
				onkeydown={submitOnEnter}
				rows="2"
				maxlength="2000"
				placeholder="Catch a thought…"
				disabled={phase === 'parsing'}
				class="w-full resize-none rounded-md border-stone-300"
			></textarea>
			<div class="mt-2 flex items-center gap-3">
				<button
					type="submit"
					disabled={phase === 'parsing' || !text.trim()}
					class="rounded-md bg-teal-700 px-4 py-1.5 font-medium text-white hover:bg-teal-800 disabled:opacity-50"
					>{phase === 'parsing' ? 'Sorting…' : 'Catch'}</button
				>
				{#if caught}<span role="status" class="text-sm text-teal-800">Caught ✓</span>{/if}
			</div>
		</form>
	{:else}
		<form onsubmit={save} onkeydown={cancelOnEscape} aria-label="Card preview" class="space-y-3">
			<div>
				<label for="preview-title" class="text-xs font-medium tracking-wide text-stone-500 uppercase">Title</label>
				<input id="preview-title" bind:this={titleInput} bind:value={title} required maxlength="200" class="mt-1 w-full rounded-md border-stone-300" />
			</div>
			<div>
				<label for="preview-pile" class="text-xs font-medium tracking-wide text-stone-500 uppercase">Pile</label>
				<select id="preview-pile" bind:value={pileChoice} required class="mt-1 w-full rounded-md border-stone-300">
					<option value="" disabled>Choose a pile…</option>
					{#if proposedPile}<option value={`new:${proposedPile}`}>✨ New pile: {proposedPile}</option>{/if}
					{#each piles as pile (pile.id)}<option value={pile.id}>{pile.name}</option>{/each}
				</select>
			</div>
			<div>
				<label for="preview-notes" class="text-xs font-medium tracking-wide text-stone-500 uppercase">Notes</label>
				<textarea id="preview-notes" bind:value={notes} rows="2" maxlength="5000" class="mt-1 w-full rounded-md border-stone-300"></textarea>
			</div>
			{#if subtasks.length > 0}
				<ul class="space-y-1 text-sm">
					{#each subtasks as subtask, i (i)}
						<li class="flex items-center gap-2">
							<span class="flex-1">☐ {subtask}</span>
							<button type="button" class="text-stone-500 hover:text-red-700" aria-label={`Remove subtask ${subtask}`} onclick={() => subtasks.splice(i, 1)}>✕</button>
						</li>
					{/each}
				</ul>
			{/if}
			{#if notice}<p role="status" class="text-sm text-amber-800">{notice}</p>{/if}
			<div class="flex gap-2">
				<button
					type="submit"
					disabled={phase === 'saving' || !pileChoice}
					class="rounded-md bg-teal-700 px-4 py-1.5 font-medium text-white hover:bg-teal-800 disabled:opacity-50"
					>{phase === 'saving' ? 'Saving…' : 'Save'}</button
				>
				<button type="button" onclick={cancel} class="rounded-md px-4 py-1.5 text-stone-700 hover:bg-stone-100">Cancel</button>
			</div>
		</form>
	{/if}
</div>
```

- [ ] **Step 5: Write the piles view** — `src/routes/+page.server.ts`

```ts
import { fail } from '@sveltejs/kit';
import { listActiveCardsByPile, markDone, reopenCard } from '$lib/server/cards';
import { NotFoundError } from '$lib/server/errors';
import { requireUser } from '$lib/server/routes';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	return { piles: await listActiveCardsByPile(locals.db, user.id) };
};

async function withCardId(
	request: Request,
	run: (id: string) => Promise<void>
): Promise<ReturnType<typeof fail> | undefined> {
	const id = String((await request.formData()).get('id') ?? '');
	try {
		await run(id);
	} catch (e) {
		if (e instanceof NotFoundError) return fail(404, { error: 'Card not found' });
		throw e;
	}
}

export const actions: Actions = {
	done: async ({ locals, request }) => {
		const user = requireUser(locals);
		return withCardId(request, (id) => markDone(locals.db, user.id, id));
	},
	reopen: async ({ locals, request }) => {
		const user = requireUser(locals);
		return withCardId(request, (id) => reopenCard(locals.db, user.id, id));
	}
};
```

`src/routes/+page.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import CaptureBox from '$lib/components/CaptureBox.svelte';

	let { data } = $props();

	let capture = $state<CaptureBox>();
	let undo = $state<{ id: string; title: string } | null>(null);
	let undoTimer: ReturnType<typeof setTimeout> | undefined;

	const pileRefs = $derived(data.piles.map((p) => ({ id: p.id, name: p.name })));

	function showUndo(card: { id: string; title: string }) {
		undo = card;
		clearTimeout(undoTimer);
		undoTimer = setTimeout(() => (undo = null), 6000);
	}

	function focusCaptureOnN(event: KeyboardEvent) {
		if (event.key !== 'n' || event.metaKey || event.ctrlKey || event.altKey) return;
		if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
		event.preventDefault();
		capture?.focus();
	}
</script>

<svelte:window onkeydown={focusCaptureOnN} />

<CaptureBox bind:this={capture} piles={pileRefs} onSaved={invalidateAll} autofocus />

<div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
	{#each data.piles as pile (pile.id)}
		<section aria-labelledby={`pile-${pile.id}`} class="rounded-lg border border-stone-200 bg-white p-4">
			<div class="flex items-baseline justify-between">
				<h2 id={`pile-${pile.id}`} class="font-semibold">{pile.name}</h2>
				<span class="text-sm text-stone-500">{pile.cards.length}</span>
			</div>
			{#if pile.cards.length === 0}
				<p class="mt-2 text-sm text-stone-400">Nothing here yet.</p>
			{:else}
				<ul class="mt-2 space-y-1.5">
					{#each pile.cards as card (card.id)}
						<li class="flex items-start gap-2">
							<form
								method="POST"
								action="?/done"
								use:enhance={() => {
									showUndo({ id: card.id, title: card.title });
									return async ({ update }) => update();
								}}
							>
								<input type="hidden" name="id" value={card.id} />
								<button
									aria-label={`Mark "${card.title}" done`}
									class="mt-0.5 size-4 rounded border border-stone-400 hover:bg-teal-100"
								></button>
							</form>
							<a href={`/card/${card.id}`} class="text-sm hover:underline">{card.title}</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/each}
</div>

{#if undo}
	<div
		role="status"
		class="fixed inset-x-0 bottom-4 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-full bg-stone-900 px-4 py-2 text-sm text-white shadow-lg"
	>
		<span class="truncate">Done: {undo.title}</span>
		<form
			method="POST"
			action="?/reopen"
			use:enhance={() => {
				undo = null;
				return async ({ update }) => update();
			}}
		>
			<input type="hidden" name="id" value={undo.id} />
			<button class="font-semibold text-teal-300 underline">Undo</button>
		</form>
	</div>
{/if}
```

- [ ] **Step 6: Write quick-add**

`src/routes/quick-add/+page.server.ts`:

```ts
import { listPiles } from '$lib/server/piles';
import { requireUser } from '$lib/server/routes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	const piles = await listPiles(locals.db, user.id);
	return { piles: piles.map(({ id, name }) => ({ id, name })) };
};
```

`src/routes/quick-add/+page.svelte`:

```svelte
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import CaptureBox from '$lib/components/CaptureBox.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Quick add · butterfly-net</title></svelte:head>

<div class="mx-auto max-w-xl">
	<CaptureBox piles={data.piles} onSaved={invalidateAll} autofocus />
	<p class="mt-3 text-center text-sm"><a href="/" class="text-stone-500 hover:text-stone-800">Open your piles →</a></p>
</div>
```

- [ ] **Step 7: Run the e2e tests to verify they pass**

Run: `npm run test:e2e -- e2e/capture.test.ts`
Expected: 8 PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add capture with Claude preview, piles view with undo, and quick-add"
```

---

### Task 11: Card detail

**Files:**
- Create: `src/routes/card/[id]/+page.server.ts`, `src/routes/card/[id]/+page.svelte`
- Test: `e2e/card.test.ts`

**Interfaces:**
- Consumes: `getCard`, `updateCard`, `setSubtasks`, `markDone`, `reopenCard`, `deleteCard` (Task 5); `listPiles` (Task 3); `cardEditSchema`, `MAX_SUBTASKS` (Task 8); `requireUser`; `NotFoundError`; `signUp`, `capture` (e2e helpers)
- Produces:
  - `/card/[id]` (404 for missing or foreign cards). Accessible names: **Title**, **Notes**, **Pile**, subtask rows **Subtask N** + checkbox **Subtask N done**, buttons **Add subtask**, **Remove subtask N**, **Save changes**, **Mark done** / **Reopen**, **Delete card** then **Yes, delete it**; status **Saved** after a save
  - Actions `?/save` (fields `title`, `notes`, `pileId`, repeated `subtask_text`, `subtask_done` = row index), `?/done`, `?/reopen`, `?/delete` (redirects to `/`)

- [ ] **Step 1: Write the failing e2e tests** — `e2e/card.test.ts`

```ts
import { expect, test } from '@playwright/test';
import { capture, signUp } from './helpers';

test('edit a card: title, notes, pile, and subtasks', async ({ page }) => {
	await signUp(page);
	await capture(page, 'Build the TIE fighter kit');
	await page.getByRole('link', { name: 'Build the TIE fighter kit' }).click();

	await page.getByLabel('Title').fill('Build the TIE interceptor kit');
	await page.getByLabel('Notes').fill('Bandai 1/72');
	await page.getByRole('button', { name: 'Add subtask' }).click();
	await page.getByLabel('Subtask 1', { exact: true }).fill('Prime the parts');
	await page.getByRole('button', { name: 'Add subtask' }).click();
	await page.getByLabel('Subtask 2', { exact: true }).fill('Paint the panels');
	await page.getByLabel('Subtask 1 done').check();
	await page.getByLabel('Pile').selectOption({ label: 'ideas' });
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.getByRole('status')).toHaveText('Saved');

	await page.reload();
	await expect(page.getByLabel('Title')).toHaveValue('Build the TIE interceptor kit');
	await expect(page.getByLabel('Notes')).toHaveValue('Bandai 1/72');
	await expect(page.getByLabel('Subtask 1', { exact: true })).toHaveValue('Prime the parts');
	await expect(page.getByLabel('Subtask 1 done')).toBeChecked();
	await expect(page.getByLabel('Subtask 2 done')).not.toBeChecked();
	await expect(page.getByLabel('Pile').locator('option:checked')).toHaveText('ideas');
});

test('mark done, reopen, and delete from the card page', async ({ page }) => {
	await signUp(page);
	await capture(page, 'Paint the AT-AT');
	await page.getByRole('link', { name: 'Paint the AT-AT' }).click();

	await page.getByRole('button', { name: 'Mark done' }).click();
	await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
	await page.getByRole('button', { name: 'Reopen' }).click();
	await expect(page.getByRole('button', { name: 'Mark done' })).toBeVisible();

	await page.getByRole('button', { name: 'Delete card' }).click();
	await page.getByRole('button', { name: 'Yes, delete it' }).click();
	await expect(page).toHaveURL('/');
	await expect(page.getByRole('link', { name: 'Paint the AT-AT' })).toHaveCount(0);
});

test("another user's card is not found", async ({ page, browser }) => {
	await signUp(page);
	await capture(page, 'Paint the secret kit');
	await page.getByRole('link', { name: 'Paint the secret kit' }).click();
	const cardUrl = page.url();

	const otherContext = await browser.newContext();
	const other = await otherContext.newPage();
	await signUp(other);
	const response = await other.goto(cardUrl);
	expect(response?.status()).toBe(404);
	await otherContext.close();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test:e2e -- e2e/card.test.ts`
Expected: FAIL — `/card/<id>` is 404 for the owner too.

- [ ] **Step 3: Write `src/routes/card/[id]/+page.server.ts`**

```ts
import { error, fail, redirect } from '@sveltejs/kit';
import {
	deleteCard,
	getCard,
	markDone,
	reopenCard,
	setSubtasks,
	updateCard
} from '$lib/server/cards';
import { NotFoundError } from '$lib/server/errors';
import { MAX_TITLE_LENGTH } from '$lib/server/parse/parse';
import { listPiles } from '$lib/server/piles';
import { requireUser } from '$lib/server/routes';
import { MAX_SUBTASKS, cardEditSchema } from '$lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = requireUser(locals);
	const card = await getCard(locals.db, user.id, params.id);
	if (!card) error(404, 'Card not found');
	return { card, piles: await listPiles(locals.db, user.id) };
};

async function orNotFound(run: () => Promise<void>): Promise<void> {
	try {
		await run();
	} catch (e) {
		if (e instanceof NotFoundError) error(404, 'Card not found');
		throw e;
	}
}

export const actions: Actions = {
	save: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const parsed = cardEditSchema.safeParse({
			title: form.get('title'),
			notes: form.get('notes'),
			pileId: form.get('pileId')
		});
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });

		const doneRows = new Set(form.getAll('subtask_done').map(String));
		const items = form
			.getAll('subtask_text')
			.map((value, i) => ({ text: String(value).trim().slice(0, MAX_TITLE_LENGTH), done: doneRows.has(String(i)) }))
			.filter((item) => item.text.length > 0)
			.slice(0, MAX_SUBTASKS);

		await orNotFound(async () => {
			await updateCard(locals.db, user.id, params.id, parsed.data);
			await setSubtasks(locals.db, user.id, params.id, items);
		});
		return { saved: true };
	},
	done: async ({ locals, params }) => {
		const user = requireUser(locals);
		await orNotFound(() => markDone(locals.db, user.id, params.id));
	},
	reopen: async ({ locals, params }) => {
		const user = requireUser(locals);
		await orNotFound(() => reopenCard(locals.db, user.id, params.id));
	},
	delete: async ({ locals, params }) => {
		const user = requireUser(locals);
		await orNotFound(() => deleteCard(locals.db, user.id, params.id));
		redirect(303, '/');
	}
};
```

- [ ] **Step 4: Write `src/routes/card/[id]/+page.svelte`**

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	// Editable copy of the subtasks; the form posts them back as parallel fields.
	let rows = $state(data.card.subtasks.map((s) => ({ text: s.text, done: s.done })));
	let confirmingDelete = $state(false);
</script>

<svelte:head><title>{data.card.title} · butterfly-net</title></svelte:head>

<a href="/" class="text-sm text-stone-500 hover:text-stone-800">← Piles</a>

<form method="POST" action="?/save" use:enhance={() => async ({ update }) => update({ reset: false })} class="mt-4 max-w-2xl space-y-4">
	<div>
		<label for="card-title" class="block text-sm font-medium">Title</label>
		<input id="card-title" name="title" value={data.card.title} required maxlength="200" class="mt-1 w-full rounded-md border-stone-300" />
	</div>
	<div>
		<label for="card-pile" class="block text-sm font-medium">Pile</label>
		<select id="card-pile" name="pileId" value={data.card.pile_id} class="mt-1 w-full rounded-md border-stone-300">
			{#each data.piles as pile (pile.id)}<option value={pile.id}>{pile.name}</option>{/each}
		</select>
	</div>
	<div>
		<label for="card-notes" class="block text-sm font-medium">Notes</label>
		<textarea id="card-notes" name="notes" rows="4" maxlength="5000" class="mt-1 w-full rounded-md border-stone-300">{data.card.notes ?? ''}</textarea>
	</div>

	<fieldset>
		<legend class="text-sm font-medium">Subtasks</legend>
		<ul class="mt-2 space-y-2">
			{#each rows as row, i (i)}
				<li class="flex items-center gap-2">
					<input type="checkbox" name="subtask_done" value={i} bind:checked={row.done} aria-label={`Subtask ${i + 1} done`} class="rounded border-stone-400" />
					<input name="subtask_text" bind:value={row.text} maxlength="200" aria-label={`Subtask ${i + 1}`} class="flex-1 rounded-md border-stone-300 text-sm" />
					<button type="button" aria-label={`Remove subtask ${i + 1}`} onclick={() => rows.splice(i, 1)} class="text-stone-500 hover:text-red-700">✕</button>
				</li>
			{/each}
		</ul>
		<button type="button" onclick={() => rows.push({ text: '', done: false })} class="mt-2 text-sm text-teal-800 hover:underline">Add subtask</button>
	</fieldset>

	{#if form?.error}<p role="alert" class="text-sm text-red-700">{form.error}</p>{/if}
	{#if form?.saved}<p role="status" class="text-sm text-teal-800">Saved</p>{/if}
	<button class="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800">Save changes</button>
</form>

<div class="mt-8 flex max-w-2xl flex-wrap items-center gap-3 border-t border-stone-200 pt-4">
	{#if data.card.status === 'active'}
		<form method="POST" action="?/done" use:enhance><button class="rounded-md border border-stone-300 px-4 py-2 hover:bg-stone-100">Mark done</button></form>
	{:else}
		<form method="POST" action="?/reopen" use:enhance><button class="rounded-md border border-stone-300 px-4 py-2 hover:bg-stone-100">Reopen</button></form>
	{/if}

	{#if confirmingDelete}
		<form method="POST" action="?/delete" use:enhance class="flex items-center gap-2">
			<span class="text-sm">Delete for good?</span>
			<button class="rounded-md bg-red-700 px-3 py-2 text-white hover:bg-red-800">Yes, delete it</button>
			<button type="button" onclick={() => (confirmingDelete = false)} class="px-3 py-2 text-stone-600">Keep it</button>
		</form>
	{:else}
		<button type="button" onclick={() => (confirmingDelete = true)} class="ml-auto text-sm text-red-700 hover:underline">Delete card</button>
	{/if}
</div>
```

- [ ] **Step 5: Run the e2e tests to verify they pass**

Run: `npm run test:e2e -- e2e/card.test.ts`
Expected: 3 PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add card detail page with editing, subtasks, done, and delete"
```

---

### Task 12: Search and archive pages

**Files:**
- Create: `src/routes/search/+page.server.ts`, `src/routes/search/+page.svelte`, `src/routes/archive/+page.server.ts`, `src/routes/archive/+page.svelte`
- Test: `e2e/search-archive.test.ts`

**Interfaces:**
- Consumes: `searchCards` (Task 6); `listArchivedCards`, `reopenCard` (Task 5); `requireUser`; `NotFoundError`; `signUp`, `capture`
- Produces:
  - `/search?q=` — search box labelled **Search your cards**, button **Search**; results list with archived results labelled **Archived**; empty state **No cards match.**
  - `/archive` — done cards newest first, each with a **Reopen** button (action `?/reopen`, field `id`); empty state **Nothing archived yet.**

- [ ] **Step 1: Write the failing e2e tests** — `e2e/search-archive.test.ts`

```ts
import { expect, test } from '@playwright/test';
import { capture, signUp } from './helpers';

test.beforeEach(async ({ page }) => {
	await signUp(page);
	await capture(page, 'Plant tomatoes by the fence');
	await capture(page, 'Paint the Millennium Falcon');
});

async function search(page: import('@playwright/test').Page, q: string) {
	await page.goto('/search');
	await page.getByLabel('Search your cards').fill(q);
	await page.getByRole('button', { name: 'Search' }).click();
}

test('finds cards by word prefix', async ({ page }) => {
	await search(page, 'tomato');
	await expect(page.getByRole('link', { name: 'Plant tomatoes by the fence' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Paint the Millennium Falcon' })).toHaveCount(0);
});

test('finds archived cards and labels them', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Mark "Paint the Millennium Falcon" done' }).click();
	await search(page, 'falcon');
	const result = page.getByRole('listitem').filter({ hasText: 'Paint the Millennium Falcon' });
	await expect(result).toContainText('Archived');
});

test('odd search text shows no results instead of an error', async ({ page }) => {
	await search(page, '"( NEAR *');
	await expect(page.getByText('No cards match.')).toBeVisible();
});

test('the archive lists done cards and can reopen them', async ({ page }) => {
	await page.goto('/archive');
	await expect(page.getByText('Nothing archived yet.')).toBeVisible();

	await page.goto('/');
	await page.getByRole('button', { name: 'Mark "Plant tomatoes by the fence" done' }).click();
	await page.goto('/archive');
	const item = page.getByRole('listitem').filter({ hasText: 'Plant tomatoes by the fence' });
	await expect(item).toContainText('garden');
	await item.getByRole('button', { name: 'Reopen' }).click();
	await expect(page.getByText('Nothing archived yet.')).toBeVisible();

	await page.goto('/');
	await expect(page.getByRole('region', { name: 'garden' })).toContainText('Plant tomatoes by the fence');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test:e2e -- e2e/search-archive.test.ts`
Expected: FAIL — `/search` returns 404.

- [ ] **Step 3: Write the search route**

`src/routes/search/+page.server.ts`:

```ts
import { requireUser } from '$lib/server/routes';
import { searchCards } from '$lib/server/search';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUser(locals);
	const q = url.searchParams.get('q') ?? '';
	return { q, results: q.trim() ? await searchCards(locals.db, user.id, q) : null };
};
```

`src/routes/search/+page.svelte`:

```svelte
<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Search · butterfly-net</title></svelte:head>

<form method="GET" class="flex max-w-2xl gap-2">
	<label for="q" class="sr-only">Search your cards</label>
	<input id="q" name="q" type="search" value={data.q} placeholder="Search your cards…" class="flex-1 rounded-md border-stone-300" />
	<button class="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800">Search</button>
</form>

{#if data.results}
	{#if data.results.length === 0}
		<p class="mt-6 text-stone-500">No cards match.</p>
	{:else}
		<ul class="mt-6 max-w-2xl space-y-2">
			{#each data.results as result (result.id)}
				<li class="rounded-md border border-stone-200 bg-white p-3">
					<a href={`/card/${result.id}`} class="font-medium hover:underline">{result.title}</a>
					<div class="mt-1 flex gap-2 text-xs text-stone-500">
						<span>{result.pile_name}</span>
						{#if result.status === 'done'}<span class="rounded bg-stone-200 px-1.5 text-stone-700">Archived</span>{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
{/if}
```

- [ ] **Step 4: Write the archive route**

`src/routes/archive/+page.server.ts`:

```ts
import { fail } from '@sveltejs/kit';
import { listArchivedCards, reopenCard } from '$lib/server/cards';
import { NotFoundError } from '$lib/server/errors';
import { requireUser } from '$lib/server/routes';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	return { cards: await listArchivedCards(locals.db, user.id) };
};

export const actions: Actions = {
	reopen: async ({ locals, request }) => {
		const user = requireUser(locals);
		const id = String((await request.formData()).get('id') ?? '');
		try {
			await reopenCard(locals.db, user.id, id);
		} catch (e) {
			if (e instanceof NotFoundError) return fail(404, { error: 'Card not found' });
			throw e;
		}
	}
};
```

`src/routes/archive/+page.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';

	let { data } = $props();

	const formatDate = (date: Date | null) =>
		date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
</script>

<svelte:head><title>Archive · butterfly-net</title></svelte:head>

<h1 class="text-xl font-semibold">Archive</h1>

{#if data.cards.length === 0}
	<p class="mt-4 text-stone-500">Nothing archived yet.</p>
{:else}
	<ul class="mt-4 max-w-2xl space-y-2">
		{#each data.cards as card (card.id)}
			<li class="flex items-center gap-3 rounded-md border border-stone-200 bg-white p-3">
				<div class="flex-1">
					<a href={`/card/${card.id}`} class="font-medium hover:underline">{card.title}</a>
					<div class="mt-1 text-xs text-stone-500">{card.pile_name} · done {formatDate(card.done_at)}</div>
				</div>
				<form method="POST" action="?/reopen" use:enhance>
					<input type="hidden" name="id" value={card.id} />
					<button class="rounded-md border border-stone-300 px-3 py-1 text-sm hover:bg-stone-100">Reopen</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}
```

- [ ] **Step 5: Run the e2e tests to verify they pass**

Run: `npm run test:e2e -- e2e/search-archive.test.ts`
Expected: 4 PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add search and archive pages"
```

---

### Task 13: Manage piles

**Files:**
- Create: `src/routes/piles/+page.server.ts`, `src/routes/piles/+page.svelte`
- Test: `e2e/piles.test.ts`

**Interfaces:**
- Consumes: `listPilesWithCounts`, `createPile`, `renamePile`, `movePile`, `deletePile` (Task 3); `DuplicatePileError`, `NotFoundError`, `PileNotEmptyError`; `pileNameSchema` (Task 8); `requireUser`; `signUp`, `capture`
- Produces:
  - `/piles` — one `listitem` per pile. Accessible names: new-pile input **New pile name** + button **Add pile**; per pile: input **Name for <name>**, **Rename**, **Move <name> up**, **Move <name> down**, **Delete <name>**; when the pile has cards, a select **Move <name>'s cards to** is shown and required
  - Actions `?/create` (`name`), `?/rename` (`id`, `name`), `?/move` (`id`, `direction`), `?/delete` (`id`, `reassignTo?`); errors returned as `form.error` in a `role="alert"`

- [ ] **Step 1: Write the failing e2e tests** — `e2e/piles.test.ts`

```ts
import { expect, test } from '@playwright/test';
import { capture, signUp } from './helpers';

test.beforeEach(async ({ page }) => {
	await signUp(page);
});

const pileNames = (page: import('@playwright/test').Page) =>
	page.getByRole('listitem').locator('input[aria-label^="Name for"]').evaluateAll((inputs) =>
		inputs.map((input) => (input as HTMLInputElement).value)
	);

test('add, rename, and reorder piles', async ({ page }) => {
	await page.goto('/piles');
	await page.getByLabel('New pile name').fill('garden');
	await page.getByRole('button', { name: 'Add pile' }).click();
	await expect.poll(() => pileNames(page)).toContain('garden');

	await page.getByLabel('Name for garden').fill('yard');
	await page.getByRole('listitem').filter({ has: page.getByLabel('Name for garden') }).getByRole('button', { name: 'Rename' }).click();
	await expect.poll(() => pileNames(page)).toContain('yard');

	await page.getByRole('button', { name: 'Move work stuff up' }).click();
	await expect.poll(async () => (await pileNames(page)).slice(0, 2)).toEqual(['work stuff', 'house']);
});

test('renaming onto an existing name is refused', async ({ page }) => {
	await page.goto('/piles');
	await page.getByLabel('Name for house').fill('IDEAS');
	await page.getByRole('listitem').filter({ has: page.getByLabel('Name for house') }).getByRole('button', { name: 'Rename' }).click();
	await expect(page.getByRole('alert')).toHaveText('A pile named "IDEAS" already exists');
});

test('an empty pile deletes directly', async ({ page }) => {
	await page.goto('/piles');
	await page.getByRole('button', { name: 'Delete ideas' }).click();
	await expect.poll(() => pileNames(page)).not.toContain('ideas');
});

test("a pile with cards asks where its cards go", async ({ page }) => {
	await capture(page, 'Paint the snowspeeder');
	await page.goto('/piles');
	await page.getByLabel("Move model building's cards to").selectOption({ label: 'ideas' });
	await page.getByRole('button', { name: 'Delete model building' }).click();
	await expect.poll(() => pileNames(page)).not.toContain('model building');

	await page.goto('/');
	await expect(page.getByRole('region', { name: 'ideas' })).toContainText('Paint the snowspeeder');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test:e2e -- e2e/piles.test.ts`
Expected: FAIL — `/piles` returns 404.

- [ ] **Step 3: Write `src/routes/piles/+page.server.ts`**

```ts
import { fail } from '@sveltejs/kit';
import { DuplicatePileError, NotFoundError, PileNotEmptyError } from '$lib/server/errors';
import { createPile, deletePile, listPilesWithCounts, movePile, renamePile } from '$lib/server/piles';
import { requireUser } from '$lib/server/routes';
import { pileNameSchema } from '$lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	return { piles: await listPilesWithCounts(locals.db, user.id) };
};

/** Runs a pile change and turns expected errors into a form message. */
async function attempt(run: () => Promise<unknown>) {
	try {
		await run();
	} catch (e) {
		if (e instanceof DuplicatePileError) return fail(400, { error: e.message });
		if (e instanceof PileNotEmptyError) return fail(400, { error: 'Choose where this pile’s cards should go first' });
		if (e instanceof NotFoundError) return fail(404, { error: 'Pile not found' });
		throw e;
	}
}

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const user = requireUser(locals);
		const name = pileNameSchema.safeParse((await request.formData()).get('name'));
		if (!name.success) return fail(400, { error: name.error.issues[0].message });
		return attempt(() => createPile(locals.db, user.id, name.data));
	},
	rename: async ({ locals, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const name = pileNameSchema.safeParse(form.get('name'));
		if (!name.success) return fail(400, { error: name.error.issues[0].message });
		return attempt(() => renamePile(locals.db, user.id, String(form.get('id')), name.data));
	},
	move: async ({ locals, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const direction = form.get('direction') === 'up' ? 'up' : 'down';
		return attempt(() => movePile(locals.db, user.id, String(form.get('id')), direction));
	},
	delete: async ({ locals, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const reassignTo = form.get('reassignTo');
		return attempt(() =>
			deletePile(locals.db, user.id, String(form.get('id')), reassignTo ? String(reassignTo) : undefined)
		);
	}
};
```

- [ ] **Step 4: Write `src/routes/piles/+page.svelte`**

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<svelte:head><title>Manage piles · butterfly-net</title></svelte:head>

<h1 class="text-xl font-semibold">Manage piles</h1>

{#if form?.error}<p role="alert" class="mt-3 text-sm text-red-700">{form.error}</p>{/if}

<ul class="mt-4 max-w-2xl space-y-3">
	{#each data.piles as pile, i (pile.id)}
		<li class="rounded-md border border-stone-200 bg-white p-3">
			<div class="flex flex-wrap items-center gap-2">
				<form method="POST" action="?/rename" use:enhance={() => async ({ update }) => update({ reset: false })} class="flex flex-1 gap-2">
					<input type="hidden" name="id" value={pile.id} />
					<input name="name" value={pile.name} required maxlength="40" aria-label={`Name for ${pile.name}`} class="min-w-0 flex-1 rounded-md border-stone-300" />
					<button class="rounded-md border border-stone-300 px-3 py-1 text-sm hover:bg-stone-100">Rename</button>
				</form>
				<form method="POST" action="?/move" use:enhance class="flex gap-1">
					<input type="hidden" name="id" value={pile.id} />
					<button name="direction" value="up" disabled={i === 0} aria-label={`Move ${pile.name} up`} class="rounded px-2 py-1 hover:bg-stone-100 disabled:opacity-30">↑</button>
					<button name="direction" value="down" disabled={i === data.piles.length - 1} aria-label={`Move ${pile.name} down`} class="rounded px-2 py-1 hover:bg-stone-100 disabled:opacity-30">↓</button>
				</form>
			</div>
			<form method="POST" action="?/delete" use:enhance class="mt-2 flex flex-wrap items-center gap-2 text-sm">
				<input type="hidden" name="id" value={pile.id} />
				<span class="text-stone-500">{pile.card_count} card{pile.card_count === 1 ? '' : 's'}</span>
				{#if pile.card_count > 0}
					<label for={`reassign-${pile.id}`} class="sr-only">Move {pile.name}'s cards to</label>
					<select id={`reassign-${pile.id}`} name="reassignTo" required class="rounded-md border-stone-300 py-1 text-sm">
						<option value="">Move cards to…</option>
						{#each data.piles.filter((p) => p.id !== pile.id) as target (target.id)}
							<option value={target.id}>{target.name}</option>
						{/each}
					</select>
				{/if}
				<button aria-label={`Delete ${pile.name}`} class="text-red-700 hover:underline">Delete</button>
			</form>
		</li>
	{/each}
</ul>

<form method="POST" action="?/create" use:enhance class="mt-6 flex max-w-2xl gap-2">
	<label for="new-pile" class="sr-only">New pile name</label>
	<input id="new-pile" name="name" required maxlength="40" placeholder="New pile…" class="flex-1 rounded-md border-stone-300" />
	<button class="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800">Add pile</button>
</form>
```

- [ ] **Step 5: Run the e2e tests to verify they pass**

Run: `npm run test:e2e -- e2e/piles.test.ts`
Expected: 4 PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add pile management: add, rename, reorder, delete with reassignment"
```

---

### Task 14: Installable PWA and the macOS hotkey

**Files:**
- Create: `static/manifest.webmanifest`, `static/icons/icon.svg`, `static/icons/icon-192.png`, `static/icons/icon-512.png`, `src/service-worker.ts`, `README.md` (replace sv's)
- Modify: `src/routes/+layout.svelte` (head tags)
- Test: `e2e/pwa.test.ts`

**Interfaces:**
- Consumes: layout (Task 9); `/quick-add` (Task 10); `isPublicPath` already allows `/manifest.webmanifest`, `/service-worker.js`, `/icons/*` (Task 4)
- Produces: a manifest with `start_url: "/"`, `display: "standalone"`, a `quick-add` shortcut; icons at 192 and 512; a registered service worker; README instructions for the Shortcuts hotkey

- [ ] **Step 1: Write the failing e2e test** — `e2e/pwa.test.ts`

```ts
import { expect, test } from '@playwright/test';

test('the manifest is linked and served without signing in', async ({ page, request }) => {
	await page.goto('/login');
	await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');

	const response = await request.get('/manifest.webmanifest');
	expect(response.ok()).toBe(true);
	const manifest = await response.json();
	expect(manifest).toMatchObject({ name: 'butterfly-net', start_url: '/', display: 'standalone' });
	expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(
		expect.arrayContaining(['192x192', '512x512'])
	);
	expect((await request.get('/icons/icon-192.png')).ok()).toBe(true);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:e2e -- e2e/pwa.test.ts`
Expected: FAIL — no `link[rel="manifest"]`.

- [ ] **Step 3: Write `static/manifest.webmanifest`**

```json
{
	"name": "butterfly-net",
	"short_name": "butterfly-net",
	"description": "Catch your thoughts before they flutter away.",
	"start_url": "/",
	"display": "standalone",
	"background_color": "#fafaf9",
	"theme_color": "#0f766e",
	"icons": [
		{ "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
		{ "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
		{ "src": "/icons/icon.svg", "sizes": "any", "type": "image/svg+xml" }
	],
	"shortcuts": [{ "name": "Quick add", "url": "/quick-add" }]
}
```

- [ ] **Step 4: Write the icon and render the PNGs**

`static/icons/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
	<rect width="512" height="512" rx="96" fill="#0f766e"/>
	<g fill="#fafaf9">
		<ellipse cx="190" cy="210" rx="90" ry="110" transform="rotate(-25 190 210)"/>
		<ellipse cx="322" cy="210" rx="90" ry="110" transform="rotate(25 322 210)"/>
		<ellipse cx="205" cy="340" rx="55" ry="70" transform="rotate(20 205 340)"/>
		<ellipse cx="307" cy="340" rx="55" ry="70" transform="rotate(-20 307 340)"/>
	</g>
	<rect x="244" y="150" width="24" height="240" rx="12" fill="#134e4a"/>
</svg>
```

```bash
npx --yes sharp-cli -i static/icons/icon.svg -o static/icons/icon-192.png resize 192 192
npx --yes sharp-cli -i static/icons/icon.svg -o static/icons/icon-512.png resize 512 512
```

Expected: two PNGs written. (If `sharp-cli` is unavailable, `qlmanage -t -s 512 -o static/icons static/icons/icon.svg` renders a 512 PNG on macOS; rename it and `sips -z 192 192` a copy.)

- [ ] **Step 5: Add the head tags to `src/routes/+layout.svelte`** — replace the `<svelte:head>` block

```svelte
<svelte:head>
	<title>butterfly-net</title>
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/icons/icon-192.png" />
	<meta name="theme-color" content="#0f766e" />
</svelte:head>
```

- [ ] **Step 6: Write a minimal service worker** — `src/service-worker.ts`

SvelteKit registers this automatically. It only makes the app installable; v1 has no offline mode, so it does not intercept fetches.

```ts
/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('install', () => {
	sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(sw.clients.claim());
});
```

- [ ] **Step 7: Replace `README.md`**

````markdown
# butterfly-net

Digital 3×5 cards. Type a thought, Claude puts it on the right pile, you confirm.

## Develop

```bash
npm install
cp .dev.vars.example .dev.vars   # then add your ANTHROPIC_API_KEY
npm run db:migrate:dev
npm run dev
```

Without an API key, capture still works: every card comes back unsorted for you to file.

## Test

```bash
npm run test:unit -- --run   # Vitest, in-memory SQLite
npm run test:e2e             # Playwright, fake Claude, throwaway e2e.db
```

Live check of Claude's sorting (costs a few cents): `ANTHROPIC_API_KEY=… npx tsx scripts/smoke-parse.ts`

## Install it like an app

- **Mac (Chrome):** open the site → ⋮ menu → *Cast, save, and share* → *Install page as app*. It gets its own window and Dock icon, and opens from Spotlight.
- **Mac (Safari):** File → *Add to Dock*.
- **iPhone (Safari):** Share → *Add to Home Screen*.

## A system-wide quick-add hotkey (macOS)

1. Open **Shortcuts** → **+** (new shortcut) → name it *Catch a thought*.
2. Add the action **Open URLs** with `https://<your-domain>/quick-add`.
3. Open the shortcut's info panel (ⓘ) → **Add Keyboard Shortcut** → press e.g. ⌃⌥Space.

Inside the app, press **n** to jump to the capture box.

## Dictate instead of typing (macOS)

Voice is the main way to catch a thought; the app just sees text.

1. **System Settings → Keyboard → Dictation:** turn it on and pick the Mac's
   connected mic as the input.
2. Press the hotkey above, press the Dictation shortcut (🎤 key, or **fn** twice),
   say the thought, then press **Return**. Rambling is fine — Claude trims it to a
   short title and keeps the detail in notes.

## Release

Production deploys only when a `v*` tag is pushed:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

## Backups

D1 export can't include virtual tables. `cards_fts` is derived data: drop it, export, then
recreate it (see `drizzle/0001_cards_fts.sql`) and re-save cards to rebuild the index.
````

Also create `.dev.vars.example`:

```
ANTHROPIC_API_KEY=
```

- [ ] **Step 8: Run the e2e test, then the whole suite**

Run: `npm run test:e2e -- e2e/pwa.test.ts && npm run test:unit -- --run && npm run test:e2e && npm run check`
Expected: all PASS; 0 type errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: make the app installable and document the quick-add hotkey"
```

---

### Task 15: CI, tag-gated deploy, and the live Claude check

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `scripts/smoke-parse.ts`
- Modify: `wrangler.toml` (D1 block)

**Interfaces:**
- Consumes: every script from Task 1; `parseCapture` and `PARSE_TIMEOUT_MS` from `src/lib/server/parse/parse.ts` (Task 7; relative imports only)
- Produces: CI on push/PR (type check, lint, unit, e2e); production deploy that fires **only** on `push: tags: ['v*']`; a manual smoke script

- [ ] **Step 1: Write the smoke script** — `scripts/smoke-parse.ts`

```ts
// Manual, costs a few cents: runs real captures through Claude and prints what it chose.
// Usage: ANTHROPIC_API_KEY=... npx tsx scripts/smoke-parse.ts
import Anthropic from '@anthropic-ai/sdk';
import { PARSE_TIMEOUT_MS, parseCapture } from '../src/lib/server/parse/parse';

const piles = ['house', 'work stuff', 'ideas', 'video games', 'model building'].map((name, i) => ({
	id: String(i),
	name
}));

// Typed-style first, then dictated-style (run-on, filler, no punctuation, a misheard word).
const samples = [
	'fix the squeaky hinge on the back door',
	'get resin and a 0.3mm drill bit for the x-wing',
	'send Q3 numbers to Dana before friday',
	'replace furnace filter',
	'paint the fence: scrape, prime, two coats',
	'order more primer',
	'update my resume',
	'um so I need to call the insurance guy about the roof because I think the storm last week took some shingles off',
	'remind me to finish the water temple before the DLC drops which is I think the end of the month',
	'so I was thinking what if there was an app that turns index cards into a to do list kind of like this one actually',
	'try an oil wash on the AT AT legs and maybe some pigment powder on the feet for dust',
	'ask about the team off site budget like how much we have and whether it covers travel',
	'look into a co-op game for game night something four people can play that is not too long',
	'what if the newsletter was audio only you know like a little podcast',
	'plant tomatoes along the south fence and get some cages and fertilizer for them'
];

const client = new Anthropic();
let fallbacks = 0;
for (const text of samples) {
	const started = performance.now();
	const result = await parseCapture(client, text, piles);
	const ms = Math.round(performance.now() - started);
	if (result.source === 'fallback') fallbacks++;
	const pile = result.pile ? `${result.pile.name}${result.pile.kind === 'new' ? ' (new)' : ''}` : '—';
	console.log(`${String(ms).padStart(5)}ms  ${result.source.padEnd(8)}  ${pile.padEnd(22)}  ${result.title}`);
}
console.log(`\n${fallbacks}/${samples.length} fell back (timeout is ${PARSE_TIMEOUT_MS}ms).`);
```

- [ ] **Step 2: Run the smoke check** (requires a real key; ask Gary to supply it in the shell)

Run: `ANTHROPIC_API_KEY=… npx tsx scripts/smoke-parse.ts`
Expected: 15 lines. Most land on the obvious pile; latency per line is printed. The last 8 are dictated-style: their titles should be short and filler-free, not transcripts. **Record the result in the idea's notes** (`~/repos/idea-forge/ideas/digital-assistant/idea.md`, answering the open question "Is Opus at low effort fast enough for capture?"). If several lines fall back because of the 5 s timeout, stop and ask Gary whether to raise the timeout or switch `PARSE_MODEL` — do not change either unilaterally.

- [ ] **Step 3: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run check
      - run: npm run lint
      - run: npm run test:unit -- --run
      - run: npm run test:e2e
```

- [ ] **Step 4: Write `.github/workflows/deploy.yml`** (tag-gated, per the global deploy rule)

```yaml
name: Deploy

on:
  push:
    tags: ['v*']

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npm run build

      - name: Apply D1 migrations
        uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: d1 migrations apply butterfly-net-db --remote

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy .svelte-kit/cloudflare --project-name=butterfly-net --branch=main
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 5: Run lint and fix anything it reports**

Run: `npm run lint`
Expected: clean. (Run `npm run format` first if Prettier flags formatting.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "ci: add CI, tag-gated Cloudflare deploy, and a live Claude smoke check"
```

- [ ] **Step 7: Provision Cloudflare and GitHub secrets — confirm with Gary before each command, since these create external resources**

The GitHub repo already exists (Task 1); this step only adds the Cloudflare resources
and the repo's Actions secrets.

```bash
npx wrangler d1 create butterfly-net-db
```

Copy the printed `database_id` into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "butterfly-net-db"
database_id = "<the id wrangler printed>"
migrations_dir = "drizzle"
```

```bash
npx wrangler pages project create butterfly-net --production-branch=main
npx wrangler pages secret put ANTHROPIC_API_KEY --project-name=butterfly-net
gh auth status   # the secrets below need gh logged in as GaryGealy; if the work account is active, run `gh auth switch` first
gh secret set CLOUDFLARE_API_TOKEN --repo GaryGealy/butterfly-net
gh secret set CLOUDFLARE_ACCOUNT_ID --repo GaryGealy/butterfly-net
```

Commit the `wrangler.toml` change:

```bash
git add wrangler.toml
git commit -m "chore: bind the production D1 database"
```

- [ ] **Step 8: Push the branch and confirm CI is green**

```bash
git push -u origin feat/v1
gh run watch
```

Expected: the CI workflow passes. Merging to `main` and tagging `v0.1.0` are left to Gary (use superpowers:finishing-a-development-branch).

- [ ] **Step 9: Link the build repo in idea-forge**

In `~/repos/idea-forge/ideas/digital-assistant/idea.md`, add `**Repo**: ~/repos/company-of-one/butterfly-net` under the Status line and set `**Status**: prototyping`, then commit in idea-forge: `idea(digital-assistant): link butterfly-net repo, move to prototyping`.
