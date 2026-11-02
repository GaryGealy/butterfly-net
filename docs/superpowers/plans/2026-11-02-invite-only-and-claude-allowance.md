# Invite-only Sign-up and Daily Claude Allowance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Only people Gary invites can sign up, through one-time invite links he creates on an admin-only page. Each non-admin user gets 20 Claude sorts a day; after that, captures fall back to "pick a pile yourself".

**Architecture:**
- Two new D1 tables:
  - `invites` holds the one-time codes. A claim is a single conditional `UPDATE … RETURNING`.
  - `parse_usage` holds one row per user per UTC day. Each count is a single upsert that returns the new total.
- Admin status comes from an `ADMIN_EMAILS` var. It is resolved once per request in `hooks.server.ts` into `locals.isAdmin`.
- Sign-up requires a usable invite code. `/invites` is admin-only, and `/api/parse` checks the allowance before calling Claude.

**Tech Stack:** SvelteKit 3.1 (Svelte 5 runes), Tailwind 4, Drizzle ORM (D1 in production; better-sqlite3 locally and in tests), Vitest, Playwright, Cloudflare Workers via wrangler 4.

**Spec:** `docs/superpowers/specs/2026-11-02-invite-only-and-claude-allowance-design.md`

## Global Constraints

- **Branch and commits:**
  - Work on a branch from up-to-date `main`; never commit to `main`.
  - Use conventional commits (`feat:`, `test:`, `chore:`, `docs:`) with **no** `Co-Authored-By` or "Generated with Claude Code" lines.
- **Unchanged:** don't change the Claude model (`claude-haiku-5-5`, low effort) or the 5 s parse timeout.
- **Invites:**
  - Invite code: 16 random bytes from `crypto.getRandomValues`, base64url, 22 characters.
  - Invite lifetime: 14 days from creation.
  - Invite link format: `<origin>/signup?invite=<code>`.
  - Invite-only message, verbatim: "Butterfly Net is invite-only right now. Ask the person who told you about it for an invite link."
- **Allowance:**
  - `DAILY_PARSE_LIMIT = 20`, in `src/lib/limits.ts`.
  - The usage day is UTC, `YYYY-MM-DD` (`now.toISOString().slice(0, 10)`).
  - Allowance notice, verbatim: "You've used today's 20 Claude sorts. Pick a pile yourself; sorting is back tomorrow." Build it from `DAILY_PARSE_LIMIT`.
- **Admin:**
  - `ADMIN_EMAILS` in `wrangler.toml` `[vars]` is `"gary.m.gealy@gmail.com"`. Match it case-insensitively, ignoring spaces around commas.
  - Admins are exempt from the allowance and aren't counted.
  - A non-admin hitting `/invites` (page or actions) gets a **404**.
- **Server code:**
  - Server modules import with relative paths (`../../lib/server/...`), as the existing routes do.
  - Svelte components import shared code with `#lib/...`.
  - Run `npm run lint` (Prettier and ESLint) and `npm run check` before every commit.

## Review Focus

These are failure modes a real user could hit that the spec implies. Each line names the task whose tests cover it.

1. **Email already taken during sign-up:** someone uses an invite link with an email that already has an account. They must get the "already exists" error, and **the same link must still work** with another email (the invite is released). Task 4 (unit and e2e).
2. **One link used twice:** the same invite link is opened in two tabs, or forwarded to a second person. Only the first sign-up succeeds, and the second sees the invite-only message, not a crash. Task 2 (unit) and Task 4 (e2e).
3. **Revoking a used invite:** a stale page lets the admin click Revoke on an invite someone already used. The used row and its "who joined" history must survive. Task 2 (unit).
4. **Messy `ADMIN_EMAILS`:** a value such as `" Gary.M.Gealy@Gmail.com , other@x.com "` must still match the lowercased session email, and an empty or unset value means no admins. Task 3 (unit).
5. **Around UTC midnight:** a user at 20 sorts at 23:59:59Z gets a fresh count at 00:00:00Z. The 21st sort on the same day is refused, not the 22nd (off-by-one). Task 6 (unit).

---

## File Map

| File | Change | Responsibility |
|---|---|---|
| `src/lib/server/db/schema.ts` | modify | add `invites`, `parseUsage` tables |
| `drizzle/0002_invites_and_parse_usage.sql` (+ `drizzle/meta/*`) | generate | migration for both tables |
| `src/lib/server/db/schema.test.ts` | modify | migrations create the new tables |
| `src/lib/server/db/index.ts` | modify | `busy_timeout` on the local SQLite file (e2e writes to it from the test process too) |
| `src/lib/server/invites.ts` | create | create / find / claim / release / mark used / revoke / list invites |
| `src/lib/server/invites.test.ts` | create | unit tests |
| `src/lib/server/admin.ts` | create | `parseAdminEmails`, `isAdminEmail` (pure) |
| `src/lib/server/admin.test.ts` | create | unit tests |
| `src/app.d.ts` | modify | `Env.ADMIN_EMAILS`, `Locals.isAdmin` |
| `wrangler.toml` | modify | `[vars] ADMIN_EMAILS` |
| `src/hooks.server.ts` | modify | set `locals.isAdmin` |
| `src/routes/+layout.server.ts`, `+layout.svelte` | modify | pass `isAdmin`; Invites header link |
| `src/routes/signup/+page.server.ts`, `+page.svelte` | modify | invite-gated sign-up |
| `src/routes/login/+page.svelte` | modify | drop "Create an account" link |
| `src/routes/invites/+page.server.ts`, `+page.svelte` | create | admin invite page |
| `src/lib/server/usage.ts` | create | `countParse` |
| `src/lib/server/usage.test.ts` | create | unit tests |
| `src/lib/limits.ts` | modify | `DAILY_PARSE_LIMIT` |
| `src/lib/types.ts` | modify | `source: 'limit'` |
| `src/routes/api/parse/+server.ts` | modify | allowance check |
| `src/lib/components/CaptureBox.svelte` | modify | allowance notice |
| `playwright.config.ts` | modify | `ADMIN_EMAILS` for the test server |
| `e2e/helpers.ts` | modify | invite-backed `signUp`, `createInviteCode`, `signInAsAdmin`, `seedParseUsage` |
| `e2e/auth.test.ts` | modify | sign-up gating tests |
| `e2e/invites.test.ts` | create | admin page tests |
| `e2e/capture.test.ts` | modify | allowance test |
| `scripts/ci-d1-smoke.sh` | modify | seed an invite before the sign-up POST |
| `README.md`, `docs/marketing.md`, `CLAUDE.md` | modify | invite-only notes |

---

### Task 1: Tables and migration

**Files:**
- Modify: `src/lib/server/db/schema.ts` (end of file; imports on line 1)
- Generate: `drizzle/0002_invites_and_parse_usage.sql`, `drizzle/meta/0002_snapshot.json`, `drizzle/meta/_journal.json`
- Modify: `src/lib/server/db/schema.test.ts`
- Modify: `src/lib/server/db/index.ts` (the local `sqlite` setup)

**Interfaces:**
- Produces:
  - `invites`: Drizzle table with columns `id`, `code`, `created_by`, `created_at`, `expires_at`, `used_at`, `used_by`.
  - `parseUsage`: Drizzle table (SQL name `parse_usage`) with columns `user_id`, `day`, `count`; the primary key is (`user_id`, `day`).

- [ ] **Step 1: Write the failing test.** In `src/lib/server/db/schema.test.ts`, change the table list in the first test to:

```ts
		for (const table of [
			'users',
			'sessions',
			'piles',
			'cards',
			'subtasks',
			'cards_fts',
			'invites',
			'parse_usage'
		]) {
```

- [ ] **Step 2: Run it and check it fails.**

Run: `npx vitest run src/lib/server/db/schema.test.ts`
Expected: FAIL, with `expected [...] to include 'invites'`.

- [ ] **Step 3: Add the tables.** In `src/lib/server/db/schema.ts`, change the import on line 1 to:

```ts
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
```

and append:

```ts
export const invites = sqliteTable('invites', {
	id: id(),
	code: text('code').notNull().unique(),
	created_by: text('created_by')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	created_at: createdAt(),
	expires_at: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
	used_at: integer('used_at', { mode: 'timestamp_ms' }),
	used_by: text('used_by').references(() => users.id, { onDelete: 'set null' })
});

/** One row per user per UTC day: how many Claude sorts they asked for. */
export const parseUsage = sqliteTable(
	'parse_usage',
	{
		user_id: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		day: text('day').notNull(),
		count: integer('count').notNull()
	},
	(t) => [primaryKey({ columns: [t.user_id, t.day] })]
);
```

- [ ] **Step 4: Generate the migration.**

Run: `npx drizzle-kit generate --name invites_and_parse_usage`
Expected: it creates `drizzle/0002_invites_and_parse_usage.sql` with two `CREATE TABLE` statements and a unique index on `invites.code`. Open it and confirm it touches nothing else, in particular that it doesn't drop or alter `cards_fts`. If it does, delete the generated files and stop.

- [ ] **Step 5: Run the tests and check they pass.**

Run: `npx vitest run src/lib/server/db/schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Make the local database wait instead of failing when busy.** The e2e helpers (Task 4) write to `e2e.db` from the Playwright process while the dev server holds it open. In `src/lib/server/db/index.ts`, after `sqlite.pragma('foreign_keys = ON');`, add:

```ts
		// e2e helpers write to the same file from another process; wait rather than fail.
		sqlite.pragma('busy_timeout = 5000');
```

- [ ] **Step 7: Run the full unit suite and the checks.**

Run: `npx vitest run && npm run lint && npm run check`
Expected: all pass.

- [ ] **Step 8: Commit.**

```bash
git add src/lib/server/db/schema.ts src/lib/server/db/schema.test.ts src/lib/server/db/index.ts drizzle/
git commit -m "feat: add invites and parse_usage tables"
```

---

### Task 2: Invite store

**Files:**
- Create: `src/lib/server/invites.ts`
- Test: `src/lib/server/invites.test.ts`

**Interfaces:**
- Consumes: `invites` and `users` from `./db/schema` (Task 1); `createTestDb` and `createTestUser` from `./test/db`.
- Produces (all in `src/lib/server/invites.ts`):
  - `INVITE_LIFETIME_MS: number` (14 days)
  - `createInvite(db: Db, adminId: string, now?: Date): Promise<{ id: string; code: string; expires_at: Date }>`
  - `findUsableInvite(db: Db, code: string, now?: Date): Promise<{ id: string } | null>`
  - `claimInvite(db: Db, code: string, now?: Date): Promise<{ id: string } | null>`
  - `releaseInvite(db: Db, id: string): Promise<void>`
  - `markInviteUsed(db: Db, id: string, userId: string): Promise<void>`
  - `revokeInvite(db: Db, id: string): Promise<boolean>` (true if an unused invite was deleted)
  - `listInvites(db: Db, now?: Date): Promise<{ unused: UnusedInvite[]; used: UsedInvite[] }>`
  - `interface UnusedInvite { id: string; code: string; created_at: Date; expires_at: Date }`
  - `interface UsedInvite { id: string; used_at: Date; email: string | null }` (`email` is null if the account was deleted)

- [ ] **Step 1: Write the failing tests.** Create `src/lib/server/invites.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from './db';
import {
	INVITE_LIFETIME_MS,
	claimInvite,
	createInvite,
	findUsableInvite,
	listInvites,
	markInviteUsed,
	releaseInvite,
	revokeInvite
} from './invites';
import { createTestDb, createTestUser } from './test/db';

const NOW = new Date('2026-11-02T12:00:00Z');
const later = (ms: number) => new Date(NOW.getTime() + ms);

let db: Db;
let adminId: string;
beforeEach(async () => {
	db = createTestDb();
	adminId = await createTestUser(db, 'admin@test.dev');
});

describe('createInvite', () => {
	it('makes a 22-character url-safe code that expires in 14 days', async () => {
		const invite = await createInvite(db, adminId, NOW);
		expect(invite.code).toMatch(/^[A-Za-z0-9_-]{22}$/);
		expect(invite.expires_at.getTime()).toBe(NOW.getTime() + INVITE_LIFETIME_MS);
		expect(INVITE_LIFETIME_MS).toBe(14 * 24 * 60 * 60 * 1000);
	});

	it('makes a different code each time', async () => {
		const a = await createInvite(db, adminId, NOW);
		const b = await createInvite(db, adminId, NOW);
		expect(a.code).not.toBe(b.code);
	});
});

describe('findUsableInvite', () => {
	it('finds an unused, unexpired code', async () => {
		const { id, code } = await createInvite(db, adminId, NOW);
		expect(await findUsableInvite(db, code, later(1000))).toEqual({ id });
	});

	it('rejects unknown, expired and used codes', async () => {
		const { code } = await createInvite(db, adminId, NOW);
		expect(await findUsableInvite(db, 'no-such-code', NOW)).toBeNull();
		expect(await findUsableInvite(db, code, later(INVITE_LIFETIME_MS))).toBeNull();
		await claimInvite(db, code, NOW);
		expect(await findUsableInvite(db, code, NOW)).toBeNull();
	});
});

describe('claimInvite', () => {
	it('succeeds once, then fails', async () => {
		const { id, code } = await createInvite(db, adminId, NOW);
		expect(await claimInvite(db, code, NOW)).toEqual({ id });
		expect(await claimInvite(db, code, NOW)).toBeNull();
	});

	it('fails for an expired code', async () => {
		const { code } = await createInvite(db, adminId, NOW);
		expect(await claimInvite(db, code, later(INVITE_LIFETIME_MS))).toBeNull();
	});

	it('can be claimed again after it is released', async () => {
		const { id, code } = await createInvite(db, adminId, NOW);
		await claimInvite(db, code, NOW);
		await releaseInvite(db, id);
		expect(await claimInvite(db, code, NOW)).toEqual({ id });
	});
});

describe('revokeInvite', () => {
	it('deletes an unused invite', async () => {
		const { id, code } = await createInvite(db, adminId, NOW);
		expect(await revokeInvite(db, id)).toBe(true);
		expect(await findUsableInvite(db, code, NOW)).toBeNull();
	});

	it('leaves a used invite and its history alone', async () => {
		const { id, code } = await createInvite(db, adminId, NOW);
		const joinerId = await createTestUser(db, 'joiner@test.dev');
		await claimInvite(db, code, NOW);
		await markInviteUsed(db, id, joinerId);
		expect(await revokeInvite(db, id)).toBe(false);
		expect((await listInvites(db, NOW)).used).toHaveLength(1);
	});
});

describe('listInvites', () => {
	it('lists unused and used invites, newest first, and hides expired unused ones', async () => {
		const old = await createInvite(db, adminId, new Date(NOW.getTime() - INVITE_LIFETIME_MS));
		const first = await createInvite(db, adminId, NOW);
		const second = await createInvite(db, adminId, later(1000));
		const used = await createInvite(db, adminId, NOW);
		const joinerId = await createTestUser(db, 'joiner@test.dev');
		await claimInvite(db, used.code, later(2000));
		await markInviteUsed(db, used.id, joinerId);

		const { unused, used: usedList } = await listInvites(db, later(3000));
		expect(unused.map((i) => i.id)).toEqual([second.id, first.id]);
		expect(unused.map((i) => i.id)).not.toContain(old.id);
		expect(usedList).toEqual([{ id: used.id, used_at: later(2000), email: 'joiner@test.dev' }]);
	});
});
```

- [ ] **Step 2: Run them and check they fail.**

Run: `npx vitest run src/lib/server/invites.test.ts`
Expected: FAIL, with `Cannot find module './invites'`.

- [ ] **Step 3: Implement.** Create `src/lib/server/invites.ts`:

```ts
import { and, desc, eq, gt, isNotNull, isNull } from 'drizzle-orm';
import type { Db } from './db';
import { invites, users } from './db/schema';

export const INVITE_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

export interface UnusedInvite {
	id: string;
	code: string;
	created_at: Date;
	expires_at: Date;
}

export interface UsedInvite {
	id: string;
	used_at: Date;
	/** Null when the account that used it has since been deleted. */
	email: string | null;
}

/** 16 random bytes as base64url: 22 characters, safe in a URL. */
function newCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

export async function createInvite(
	db: Db,
	adminId: string,
	now = new Date()
): Promise<{ id: string; code: string; expires_at: Date }> {
	const [invite] = await db
		.insert(invites)
		.values({
			code: newCode(),
			created_by: adminId,
			created_at: now,
			expires_at: new Date(now.getTime() + INVITE_LIFETIME_MS)
		})
		.returning({ id: invites.id, code: invites.code, expires_at: invites.expires_at });
	return invite;
}

const usable = (code: string, now: Date) =>
	and(eq(invites.code, code), isNull(invites.used_at), gt(invites.expires_at, now));

export async function findUsableInvite(
	db: Db,
	code: string,
	now = new Date()
): Promise<{ id: string } | null> {
	const [invite] = await db
		.select({ id: invites.id })
		.from(invites)
		.where(usable(code, now))
		.limit(1);
	return invite ?? null;
}

/** Marks the code used in one statement, so of two simultaneous sign-ups only one wins. */
export async function claimInvite(
	db: Db,
	code: string,
	now = new Date()
): Promise<{ id: string } | null> {
	const [invite] = await db
		.update(invites)
		.set({ used_at: now })
		.where(usable(code, now))
		.returning({ id: invites.id });
	return invite ?? null;
}

/** Undoes a claim when the account couldn't be created, so the link still works. */
export async function releaseInvite(db: Db, id: string): Promise<void> {
	await db.update(invites).set({ used_at: null }).where(eq(invites.id, id));
}

export async function markInviteUsed(db: Db, id: string, userId: string): Promise<void> {
	await db.update(invites).set({ used_by: userId }).where(eq(invites.id, id));
}

/** Deletes an unused invite. A used one is kept, along with who joined through it. */
export async function revokeInvite(db: Db, id: string): Promise<boolean> {
	const deleted = await db
		.delete(invites)
		.where(and(eq(invites.id, id), isNull(invites.used_at)))
		.returning({ id: invites.id });
	return deleted.length > 0;
}

export async function listInvites(
	db: Db,
	now = new Date()
): Promise<{ unused: UnusedInvite[]; used: UsedInvite[] }> {
	const unused = await db
		.select({
			id: invites.id,
			code: invites.code,
			created_at: invites.created_at,
			expires_at: invites.expires_at
		})
		.from(invites)
		.where(and(isNull(invites.used_at), gt(invites.expires_at, now)))
		.orderBy(desc(invites.created_at));
	const usedRows = await db
		.select({ id: invites.id, used_at: invites.used_at, email: users.email })
		.from(invites)
		.leftJoin(users, eq(invites.used_by, users.id))
		.where(isNotNull(invites.used_at))
		.orderBy(desc(invites.used_at));
	const used = usedRows.map((row) => ({ ...row, used_at: row.used_at as Date }));
	return { unused, used };
}
```

- [ ] **Step 4: Run the tests and check they pass.**

Run: `npx vitest run src/lib/server/invites.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Run the checks and commit.**

```bash
npm run lint && npm run check
git add src/lib/server/invites.ts src/lib/server/invites.test.ts
git commit -m "feat: invite store with one-time claims"
```

---

### Task 3: Admin check and header link

**Files:**
- Create: `src/lib/server/admin.ts`
- Test: `src/lib/server/admin.test.ts`
- Modify: `src/app.d.ts`, `wrangler.toml`, `src/hooks.server.ts`, `src/routes/+layout.server.ts`, `src/routes/+layout.svelte`

**Interfaces:**
- Produces:
  - `parseAdminEmails(raw: string | undefined): Set<string>`
  - `isAdminEmail(email: string, raw: string | undefined): boolean`
  - `App.Locals.isAdmin: boolean`, set by the hook for every request (false when signed out)
  - Layout data `isAdmin: boolean`

- [ ] **Step 1: Write the failing tests.** Create `src/lib/server/admin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isAdminEmail, parseAdminEmails } from './admin';

describe('parseAdminEmails', () => {
	it('lowercases, trims and drops empty entries', () => {
		expect(parseAdminEmails(' Gary.M.Gealy@Gmail.com , other@x.com ,, ')).toEqual(
			new Set(['gary.m.gealy@gmail.com', 'other@x.com'])
		);
	});

	it('is empty when unset or blank', () => {
		expect(parseAdminEmails(undefined).size).toBe(0);
		expect(parseAdminEmails('  ').size).toBe(0);
	});
});

describe('isAdminEmail', () => {
	it('matches the session email against the list, ignoring case', () => {
		expect(isAdminEmail('gary.m.gealy@gmail.com', 'Gary.M.Gealy@gmail.com')).toBe(true);
		expect(isAdminEmail('someone@else.com', 'gary.m.gealy@gmail.com')).toBe(false);
	});

	it('is false for everyone when the list is unset', () => {
		expect(isAdminEmail('gary.m.gealy@gmail.com', undefined)).toBe(false);
	});
});
```

- [ ] **Step 2: Run them and check they fail.**

Run: `npx vitest run src/lib/server/admin.test.ts`
Expected: FAIL, with `Cannot find module './admin'`.

- [ ] **Step 3: Implement.** Create `src/lib/server/admin.ts`:

```ts
/** `ADMIN_EMAILS` is a comma-separated list; spacing and case don't matter. */
export function parseAdminEmails(raw: string | undefined): Set<string> {
	return new Set(
		(raw ?? '')
			.split(',')
			.map((email) => email.trim().toLowerCase())
			.filter(Boolean)
	);
}

export function isAdminEmail(email: string, raw: string | undefined): boolean {
	return parseAdminEmails(raw).has(email.trim().toLowerCase());
}
```

- [ ] **Step 4: Run the tests and check they pass.**

Run: `npx vitest run src/lib/server/admin.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire it into the app.**

In `wrangler.toml`, after the `workers_dev = true` line, add:

```toml

# Accounts that can open /invites and aren't limited to the daily Claude allowance.
[vars]
ADMIN_EMAILS = "gary.m.gealy@gmail.com"
```

`[vars]` must come before the `[assets]` table so TOML doesn't read it as part of `[assets]`. Put it directly above `[assets]`.

In `src/app.d.ts`, inside `interface Env`, after `ANTHROPIC_API_KEY?: string;`, add:

```ts
			/** Comma-separated admin emails, from wrangler.toml [vars]. */
			ADMIN_EMAILS?: string;
```

and inside `interface Locals`, add:

```ts
			isAdmin: boolean;
```

In `src/hooks.server.ts`, add the imports:

```ts
import { dev } from '$app/env';
import { isAdminEmail } from './lib/server/admin';
```

and after the `event.locals.user = …` line, add:

```ts
	// The e2e server names its own admins; everywhere else the wrangler.toml var decides.
	const adminEmails =
		dev && process.env.ADMIN_EMAILS !== undefined ? process.env.ADMIN_EMAILS : env.ADMIN_EMAILS;
	event.locals.isAdmin = event.locals.user
		? isAdminEmail(event.locals.user.email, adminEmails)
		: false;
```

Replace `src/routes/+layout.server.ts` with:

```ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	user: locals.user ? { email: locals.user.email } : null,
	isAdmin: locals.isAdmin
});
```

In `src/routes/+layout.svelte`, directly after the `{/each}` that renders the nav links and before `<div class="flex min-w-0 items-center gap-3">`, add:

```svelte
					{#if data.isAdmin}
						<a
							href={resolve('/invites')}
							class="font-bold text-muted hover:text-ink aria-[current=page]:text-ink"
							aria-current={page.url.pathname === '/invites' ? 'page' : undefined}>Invites</a
						>
					{/if}
```

`resolve('/invites')` won't type-check until the route exists in Task 5. If `npm run check` rejects it, create an empty `src/routes/invites/+page.svelte` containing just `<h1>Invites</h1>` now; Task 5 replaces it.

- [ ] **Step 6: Run everything.**

Run: `npx vitest run && npm run lint && npm run check && npx playwright test`
Expected: all pass. Sign-up isn't gated yet, so the e2e tests are unaffected.

- [ ] **Step 7: Commit.**

```bash
git add src/lib/server/admin.ts src/lib/server/admin.test.ts src/app.d.ts wrangler.toml src/hooks.server.ts src/routes/+layout.server.ts src/routes/+layout.svelte src/routes/invites
git commit -m "feat: admin accounts from ADMIN_EMAILS, with an Invites header link"
```

---

### Task 4: Invite-only sign-up

Once sign-up needs an invite, every e2e test that signs up breaks. This task therefore also changes the e2e helper, the Playwright config and the CI D1 smoke script.

**Files:**
- Modify: `src/routes/signup/+page.server.ts`, `src/routes/signup/+page.svelte`, `src/routes/login/+page.svelte`
- Modify: `e2e/helpers.ts`, `e2e/auth.test.ts`, `playwright.config.ts`
- Modify: `scripts/ci-d1-smoke.sh`

**Interfaces:**
- Consumes: `findUsableInvite`, `claimInvite`, `releaseInvite`, `markInviteUsed` (Task 2).
- Produces:
  - Sign-up page data `invite: string | null`.
  - Action failure shapes `{ email, error }` (as today) and `{ email, inviteRejected: true }`.
  - e2e helpers:
    - `createInviteCode(): string`
    - `signUp(page, email?): Promise<string>`
    - `signInAsAdmin(page, email): Promise<void>`
    - `E2E_DB = 'e2e.db'`
  - Playwright env `ADMIN_EMAILS = 'admin-1@e2e.test,admin-2@e2e.test,admin-3@e2e.test'`.

- [ ] **Step 1: Write the failing e2e tests.** In `e2e/helpers.ts`, add these imports at the top:

```ts
import Database from 'better-sqlite3';
```

Then add these helpers and replace `signUp`:

```ts
/** The dev server's database for the e2e run (see playwright.config.ts). */
export const E2E_DB = 'e2e.db';

function openE2eDb() {
	const db = new Database(E2E_DB);
	db.pragma('busy_timeout = 5000');
	return db;
}

/** Inserts a fresh invite straight into the e2e database and returns its code. */
export function createInviteCode(): string {
	const db = openE2eDb();
	try {
		const now = Date.now();
		db.prepare(
			`INSERT OR IGNORE INTO users (id, email, password_hash, created_at)
			 VALUES ('e2e-inviter', 'inviter@e2e.test', 'unused', ?)`
		).run(now);
		const code = crypto.randomUUID().replaceAll('-', '');
		db.prepare(
			`INSERT INTO invites (id, code, created_by, created_at, expires_at)
			 VALUES (?, ?, 'e2e-inviter', ?, ?)`
		).run(crypto.randomUUID(), code, now, now + 14 * 24 * 60 * 60 * 1000);
		return code;
	} finally {
		db.close();
	}
}

export async function signUp(page: Page, email = randomEmail()): Promise<string> {
	await gotoReady(page, `/signup?invite=${createInviteCode()}`);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await waitForHydration(page);
	return email;
}

export function randomEmail(): string {
	return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.dev`;
}

/** Signs up as one of the e2e admins, or logs in if a retried test already made the account. */
export async function signInAsAdmin(page: Page, email: string): Promise<void> {
	await gotoReady(page, '/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Log in' }).click();
	// Wait for the outcome: the wrong-password alert (no account yet) or the piles page.
	const alert = page.getByRole('alert');
	await expect(alert.or(page.getByRole('link', { name: 'Manage piles' }))).toBeVisible();
	if (await alert.isVisible()) {
		await signUp(page, email);
		return;
	}
	await waitForHydration(page);
}
```

In `playwright.config.ts`, change the `webServer.env` line to:

```ts
		env: {
			DATABASE_URL: 'e2e.db',
			FAKE_CLAUDE: '1',
			// Each admin test uses its own account, so parallel tests don't collide.
			ADMIN_EMAILS: 'admin-1@e2e.test,admin-2@e2e.test,admin-3@e2e.test'
		},
```

In `e2e/auth.test.ts`:
- Change the import to `import { PASSWORD, createInviteCode, gotoReady, logOut, signUp } from './helpers';`.
- Replace the test `'signing up twice with one email is refused'` with the block below.

```ts
const INVITE_ONLY = 'Butterfly Net is invite-only right now.';

test('sign-up without a usable invite shows the invite-only message', async ({ page }) => {
	for (const url of ['/signup', '/signup?invite=not-a-real-code']) {
		await gotoReady(page, url);
		await expect(page.getByText(INVITE_ONLY)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Create account' })).toHaveCount(0);
	}
});

test('an invite link works once', async ({ page }) => {
	const code = createInviteCode();
	await gotoReady(page, `/signup?invite=${code}`);
	await page.getByLabel('Email').fill(`once-${Date.now()}@test.dev`);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await logOut(page);

	await gotoReady(page, `/signup?invite=${code}`);
	await expect(page.getByText(INVITE_ONLY)).toBeVisible();
});

test('a taken email is refused and the invite link still works', async ({ page }) => {
	const email = await signUp(page);
	await logOut(page);

	const code = createInviteCode();
	await gotoReady(page, `/signup?invite=${code}`);
	await page.getByLabel('Email').fill(email.toUpperCase());
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByRole('alert')).toHaveText('An account with that email already exists');

	await page.getByLabel('Email').fill(`second-${Date.now()}@test.dev`);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
});

test('the log-in page no longer offers sign-up', async ({ page }) => {
	await gotoReady(page, '/login');
	await expect(page.getByRole('link', { name: 'Create an account' })).toHaveCount(0);
});
```

- [ ] **Step 2: Run them and check they fail.**

Run: `npx playwright test e2e/auth.test.ts`
Expected: the four new tests fail. For example, `/signup` with no invite still shows the form. The other auth tests pass.

- [ ] **Step 3: Gate the sign-up server.** Replace `src/routes/signup/+page.server.ts` with:

```ts
import { fail, redirect } from '@sveltejs/kit';
import { EmailTakenError, createSession, registerUser } from '../../lib/server/auth';
import {
	claimInvite,
	findUsableInvite,
	markInviteUsed,
	releaseInvite
} from '../../lib/server/invites';
import { setSessionCookie } from '../../lib/server/session-cookie';
import { credentialsSchema } from '../../lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) redirect(303, '/');
	const code = url.searchParams.get('invite') ?? '';
	const invite = code ? await findUsableInvite(locals.db, code) : null;
	return { invite: invite ? code : null };
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const parsed = credentialsSchema.safeParse({ email, password: form.get('password') });
		if (!parsed.success) return fail(400, { email, error: parsed.error.issues[0].message });

		const invite = await claimInvite(locals.db, String(form.get('invite') ?? ''));
		if (!invite) return fail(400, { email, inviteRejected: true });

		let user;
		try {
			user = await registerUser(locals.db, parsed.data.email, parsed.data.password);
		} catch (e) {
			// No account was made, so give the link back: a taken email doesn't burn the invite.
			await releaseInvite(locals.db, invite.id);
			if (e instanceof EmailTakenError) return fail(400, { email, error: e.message });
			throw e;
		}
		await markInviteUsed(locals.db, invite.id, user.id);
		setSessionCookie(cookies, await createSession(locals.db, user.id));
		redirect(303, '/');
	}
};
```

- [ ] **Step 4: Gate the sign-up page.** In `src/routes/signup/+page.svelte`, change `let { form } = $props();` to `let { data, form } = $props();`. Replace everything from `<h1 class="mt-4 text-2xl font-extrabold">Create your account</h1>` through the closing `</form>` with:

```svelte
	{#if data.invite && !form?.inviteRejected}
		<h1 class="mt-4 text-2xl font-extrabold">Create your account</h1>
		<p class="mb-6 font-bold text-muted">Catch your thoughts before they flutter away.</p>
		<form method="POST" use:enhance class="space-y-4">
			<input type="hidden" name="invite" value={data.invite} />
			<div>
				<label for="email" class="block text-sm font-bold text-ink-soft">Email</label>
				<input
					id="email"
					name="email"
					type="email"
					maxlength={MAX_EMAIL_LENGTH}
					autocomplete="email"
					required
					value={form?.email}
					class="field mt-1"
				/>
			</div>
			<div>
				<label for="password" class="block text-sm font-bold text-ink-soft">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="new-password"
					minlength="8"
					required
					class="field mt-1"
				/>
			</div>
			{#if form?.error}<p role="alert" class="text-sm font-bold text-red-700">{form.error}</p>{/if}
			<button class="btn-primary w-full">Create account</button>
		</form>
	{:else}
		<h1 class="mt-4 text-2xl font-extrabold">Invite only</h1>
		<p class="mt-1 font-bold text-muted">
			Butterfly Net is invite-only right now. Ask the person who told you about it for an invite
			link.
		</p>
	{/if}
```

The "Already have an account? Log in" paragraph below stays.

- [ ] **Step 5: Drop the sign-up link from log-in.** In `src/routes/login/+page.svelte`, delete the whole paragraph that starts `<p class="mt-5 text-sm font-bold text-muted">` and contains `New here? <a href={resolve('/signup')}`. If `resolve` is then unused there, remove its import too.

- [ ] **Step 6: Run the e2e suite.**

Run: `npx playwright test`
Expected: all pass, including the four new auth tests. Every existing test now signs up through an invite via the helper.

- [ ] **Step 7: Update the D1 smoke script.** In `scripts/ci-d1-smoke.sh`, directly before the line `# 2. Signup (form action) redirects home and sets a session cookie.`, add:

```bash
# Sign-up is invite-only, so seed an inviter and an invite in the local D1 first.
invite="smoke-invite-$RANDOM$RANDOM"
now_ms=$(( $(date +%s) * 1000 ))
(cd "$WORK" && "$WRANGLER" d1 execute butterfly-net-db --local --persist-to "$WORK/state" --command \
	"INSERT INTO users (id, email, password_hash, created_at) VALUES ('smoke-inviter', 'inviter@smoke.test', 'unused', $now_ms);
	 INSERT INTO invites (id, code, created_by, created_at, expires_at) VALUES ('smoke-invite', '$invite', 'smoke-inviter', $now_ms, $(( now_ms + 86400000 )));") >/dev/null
```

and in the sign-up `curl`, after `--data-urlencode "password=correct-horse-battery"`, add ` --data-urlencode "invite=$invite"`.

- [ ] **Step 8: Run the D1 smoke locally.**

Run: `npm run build && bash scripts/ci-d1-smoke.sh`
Expected: it ends with `D1 smoke passed.`

- [ ] **Step 9: Run the checks and commit.**

```bash
npx vitest run && npm run lint && npm run check
git add src/routes/signup src/routes/login/+page.svelte e2e/helpers.ts e2e/auth.test.ts playwright.config.ts scripts/ci-d1-smoke.sh
git commit -m "feat: sign-up requires a one-time invite link"
```

---

### Task 5: Invites page

**Files:**
- Create (or replace the Task 3 placeholder): `src/routes/invites/+page.server.ts`, `src/routes/invites/+page.svelte`
- Create: `e2e/invites.test.ts`

**Interfaces:**
- Consumes:
  - `createInvite`, `listInvites`, `revokeInvite`, `UnusedInvite`, `UsedInvite` (Task 2)
  - `locals.isAdmin` (Task 3)
  - `signInAsAdmin`, `signUp`, `gotoReady`, `logOut`, `PASSWORD`, `waitForHydration` from `e2e/helpers.ts` (Task 4)
- Produces:
  - Page data `{ origin: string; unused: UnusedInvite[]; used: UsedInvite[] }`
  - Actions `create` (returns `{ created: string }`, the full link) and `revoke` (form field `id`)

- [ ] **Step 1: Write the failing e2e tests.** Create `e2e/invites.test.ts`:

```ts
import { expect, test } from '@playwright/test';
import { PASSWORD, gotoReady, logOut, signInAsAdmin, signUp, waitForHydration } from './helpers';

test('the admin creates an invite link and someone joins with it', async ({ page }) => {
	await signInAsAdmin(page, 'admin-1@e2e.test');
	await page.getByRole('link', { name: 'Invites' }).click();
	await waitForHydration(page);
	await page.getByRole('button', { name: 'Create invite link' }).click();
	const link = page.getByLabel('New invite link');
	await expect(link).toHaveValue(/\/signup\?invite=[A-Za-z0-9_-]{22}$/);
	const url = new URL(await link.inputValue());
	await logOut(page);

	const joiner = `joiner-${Date.now()}@test.dev`;
	await gotoReady(page, url.pathname + url.search);
	await page.getByLabel('Email').fill(joiner);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await logOut(page);

	await signInAsAdmin(page, 'admin-1@e2e.test');
	await gotoReady(page, '/invites');
	await expect(page.getByRole('region', { name: 'Used' })).toContainText(joiner);
});

test('the admin can revoke an unused link', async ({ page }) => {
	await signInAsAdmin(page, 'admin-2@e2e.test');
	await gotoReady(page, '/invites');
	await page.getByRole('button', { name: 'Create invite link' }).click();
	const code = new URL(await page.getByLabel('New invite link').inputValue()).searchParams.get(
		'invite'
	)!;
	const unused = page.getByRole('region', { name: 'Unused' });
	await unused.getByRole('listitem').filter({ hasText: code }).getByRole('button', { name: 'Revoke' }).click();
	await expect(unused).not.toContainText(code);

	await logOut(page);
	await gotoReady(page, `/signup?invite=${code}`);
	await expect(page.getByText('Butterfly Net is invite-only right now.')).toBeVisible();
});

test('other users get a 404 and see no Invites link', async ({ page }) => {
	await signUp(page);
	await expect(page.getByRole('link', { name: 'Invites' })).toHaveCount(0);
	const response = await page.goto('/invites');
	expect(response?.status()).toBe(404);
	const action = await page.request.post('/invites?/create', {
		form: {},
		headers: { origin: new URL(page.url()).origin }
	});
	expect(action.status()).toBe(404);
});
```

- [ ] **Step 2: Run them and check they fail.**

Run: `npx playwright test e2e/invites.test.ts`
Expected: FAIL. There's no "Create invite link" button, and `/invites` returns 200 (the placeholder) or 404 for everyone.

- [ ] **Step 3: Implement the server.** Create `src/routes/invites/+page.server.ts`:

```ts
import { error } from '@sveltejs/kit';
import { createInvite, listInvites, revokeInvite } from '../../lib/server/invites';
import { requireUser } from '../../lib/server/routes';
import type { Actions, PageServerLoad } from './$types';

/** Non-admins get a 404, so the page's existence isn't revealed. */
function requireAdmin(locals: App.Locals) {
	const user = requireUser(locals);
	if (!locals.isAdmin) error(404, 'Not found');
	return user;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	requireAdmin(locals);
	return { origin: url.origin, ...(await listInvites(locals.db)) };
};

export const actions: Actions = {
	create: async ({ locals, url }) => {
		const admin = requireAdmin(locals);
		const { code } = await createInvite(locals.db, admin.id);
		return { created: `${url.origin}/signup?invite=${code}` };
	},
	revoke: async ({ locals, request }) => {
		requireAdmin(locals);
		await revokeInvite(locals.db, String((await request.formData()).get('id') ?? ''));
	}
};
```

- [ ] **Step 4: Implement the page.** Create `src/routes/invites/+page.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let copied = $state<string | null>(null);

	async function copy(link: string) {
		await navigator.clipboard.writeText(link);
		copied = link;
		setTimeout(() => (copied = copied === link ? null : copied), 2000);
	}

	const linkFor = (code: string) => `${data.origin}/signup?invite=${code}`;
	const day = (date: Date) =>
		date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
</script>

<svelte:head><title>Invites · Butterfly Net</title></svelte:head>

<h1 class="text-2xl font-extrabold">Invites</h1>
<p class="mt-1 font-bold text-muted">
	Each link lets one person create an account. Links expire after 14 days.
</p>

<form method="POST" action="?/create" use:enhance class="mt-5">
	<button class="btn-primary">Create invite link</button>
</form>

{#if form?.created}
	{@const created = form.created}
	<div class="chip mt-4 flex max-w-2xl items-center gap-2 p-2 pl-4">
		<label for="new-invite" class="sr-only">New invite link</label>
		<input
			id="new-invite"
			readonly
			value={created}
			class="min-w-0 flex-1 border-0 bg-transparent p-0 font-semibold focus:ring-0"
		/>
		<button type="button" class="btn-secondary shrink-0" onclick={() => copy(created)}
			>{copied === created ? 'Copied' : 'Copy'}</button
		>
	</div>
{/if}

<section aria-labelledby="unused-heading" class="mt-8 max-w-2xl">
	<h2 id="unused-heading" class="text-lg font-extrabold">Unused</h2>
	{#if data.unused.length === 0}
		<p class="mt-2 font-bold text-muted">No open invite links.</p>
	{:else}
		<ul class="mt-2 space-y-2">
			{#each data.unused as invite (invite.id)}
				<li class="chip flex flex-wrap items-center gap-2 py-2 pr-2 pl-4">
					<span class="min-w-0 flex-1 truncate font-mono text-sm">{invite.code}</span>
					<span class="text-sm font-bold text-muted">expires {day(invite.expires_at)}</span>
					<button type="button" class="btn-quiet" onclick={() => copy(linkFor(invite.code))}
						>{copied === linkFor(invite.code) ? 'Copied' : 'Copy'}</button
					>
					<form method="POST" action="?/revoke" use:enhance>
						<input type="hidden" name="id" value={invite.id} />
						<button class="btn-danger">Revoke</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section aria-labelledby="used-heading" class="mt-8 max-w-2xl">
	<h2 id="used-heading" class="text-lg font-extrabold">Used</h2>
	{#if data.used.length === 0}
		<p class="mt-2 font-bold text-muted">Nobody has joined through an invite yet.</p>
	{:else}
		<ul class="mt-2 space-y-2">
			{#each data.used as invite (invite.id)}
				<li class="chip flex items-center justify-between gap-2 px-4 py-2">
					<span class="font-bold">{invite.email ?? 'Deleted account'}</span>
					<span class="text-sm font-bold text-muted">joined {day(invite.used_at)}</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>
```

Each `<section>` gets its accessible name from its `<h2>` through `aria-labelledby`, so the test's `getByRole('region', { name: 'Unused' })` finds it. The dates use `timeZone: 'UTC'`, so the server-rendered and hydrated text match.

- [ ] **Step 5: Run the tests and check they pass.**

Run: `npx playwright test e2e/invites.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Run everything and commit.**

```bash
npx vitest run && npm run lint && npm run check && npx playwright test
git add src/routes/invites e2e/invites.test.ts
git commit -m "feat: admin page to create, copy and revoke invite links"
```

---

### Task 6: Daily Claude allowance

**Files:**
- Create: `src/lib/server/usage.ts`, `src/lib/server/usage.test.ts`
- Modify: `src/lib/limits.ts`, `src/lib/types.ts`, `src/routes/api/parse/+server.ts`, `src/lib/components/CaptureBox.svelte`
- Modify: `e2e/helpers.ts`, `e2e/capture.test.ts`

**Interfaces:**
- Consumes:
  - `parseUsage` (Task 1)
  - `locals.isAdmin` (Task 3)
  - `fallbackResult(text: string): ParseResult` from `src/lib/server/parse/parse.ts` (existing)
  - `E2E_DB`, `signUp` (Task 4)
- Produces:
  - `DAILY_PARSE_LIMIT = 20`
  - `usageDay(now: Date): string`
  - `countParse(db: Db, userId: string, now?: Date): Promise<number>` (the new count for that day)
  - `ParseResult.source: 'claude' | 'fallback' | 'limit'`
  - e2e `seedParseUsage(email: string, count: number): void`

- [ ] **Step 1: Write the failing unit tests.** Create `src/lib/server/usage.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from './db';
import { createTestDb, createTestUser } from './test/db';
import { countParse, usageDay } from './usage';

let db: Db;
let userId: string;
beforeEach(async () => {
	db = createTestDb();
	userId = await createTestUser(db);
});

describe('usageDay', () => {
	it('is the UTC calendar day', () => {
		expect(usageDay(new Date('2026-11-02T23:59:59.999Z'))).toBe('2026-11-02');
		expect(usageDay(new Date('2026-11-03T00:00:00.000Z'))).toBe('2026-11-03');
	});
});

describe('countParse', () => {
	it('counts up from 1 within a day', async () => {
		const now = new Date('2026-11-02T10:00:00Z');
		const counts = [];
		for (let i = 0; i < 21; i++) counts.push(await countParse(db, userId, now));
		expect(counts).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
	});

	it('starts again at 1 at midnight UTC', async () => {
		await countParse(db, userId, new Date('2026-11-02T23:59:59Z'));
		await countParse(db, userId, new Date('2026-11-02T23:59:59Z'));
		expect(await countParse(db, userId, new Date('2026-11-03T00:00:00Z'))).toBe(1);
	});

	it('counts each user separately', async () => {
		const other = await createTestUser(db);
		const now = new Date('2026-11-02T10:00:00Z');
		await countParse(db, userId, now);
		await countParse(db, userId, now);
		expect(await countParse(db, other, now)).toBe(1);
	});
});
```

- [ ] **Step 2: Run them and check they fail.**

Run: `npx vitest run src/lib/server/usage.test.ts`
Expected: FAIL, with `Cannot find module './usage'`.

- [ ] **Step 3: Implement.** Create `src/lib/server/usage.ts`:

```ts
import { sql } from 'drizzle-orm';
import type { Db } from './db';
import { parseUsage } from './db/schema';

/** The allowance resets at midnight UTC. */
export function usageDay(now: Date): string {
	return now.toISOString().slice(0, 10);
}

/** Counts one Claude sort for the user today and returns today's new total, in one statement. */
export async function countParse(db: Db, userId: string, now = new Date()): Promise<number> {
	const [row] = await db
		.insert(parseUsage)
		.values({ user_id: userId, day: usageDay(now), count: 1 })
		.onConflictDoUpdate({
			target: [parseUsage.user_id, parseUsage.day],
			set: { count: sql`${parseUsage.count} + 1` }
		})
		.returning({ count: parseUsage.count });
	return row.count;
}
```

- [ ] **Step 4: Run the tests and check they pass.**

Run: `npx vitest run src/lib/server/usage.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing e2e test.** In `e2e/helpers.ts`, add:

```ts
/** Sets how many Claude sorts the user has used today (UTC), straight in the e2e database. */
export function seedParseUsage(email: string, count: number): void {
	const db = openE2eDb();
	try {
		const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string };
		db.prepare(
			`INSERT INTO parse_usage (user_id, day, count) VALUES (?, ?, ?)
			 ON CONFLICT (user_id, day) DO UPDATE SET count = excluded.count`
		).run(user.id, new Date().toISOString().slice(0, 10), count);
	} finally {
		db.close();
	}
}
```

`e2e/capture.test.ts` signs up in its `beforeEach` without keeping the email, so this test logs that user out and signs up one whose email it knows. Append to `e2e/capture.test.ts`:

```ts
test.describe('daily allowance', () => {
	test('past 20 sorts a day, the preview asks you to pick the pile', async ({ page }) => {
		await logOut(page);
		const email = await signUp(page);
		seedParseUsage(email, 20);

		await page.getByLabel('Catch a thought').fill('Paint the Y-wing');
		await page.getByRole('button', { name: 'Catch' }).click();
		const preview = page.getByRole('form', { name: 'Card preview' });
		await expect(preview.getByRole('status')).toHaveText(
			"You've used today's 20 Claude sorts. Pick a pile yourself; sorting is back tomorrow."
		);
		await expect(preview.getByRole('button', { name: 'Save' })).toBeDisabled();
		await preview.getByLabel('Pile').selectOption({ label: 'model building' });
		await preview.getByRole('button', { name: 'Save' }).click();
		await expect(page.getByRole('region', { name: 'model building' })).toContainText(
			'Paint the Y-wing'
		);
	});
});
```

and change the helpers import at the top of `e2e/capture.test.ts` to include `logOut` and `seedParseUsage`:

```ts
import { capture, gotoReady, logOut, seedParseUsage, signUp } from './helpers';
```

- [ ] **Step 6: Run it and check it fails.**

Run: `npx playwright test e2e/capture.test.ts -g "daily allowance"`
Expected: FAIL. The preview shows the fake Claude's pile, with no allowance notice.

- [ ] **Step 7: Add the limit and the new source.** In `src/lib/limits.ts`, append:

```ts
// Claude sorts per non-admin user per UTC day; past it, captures fall back to picking a pile.
export const DAILY_PARSE_LIMIT = 20;
```

In `src/lib/types.ts`, change the `source` line to:

```ts
	source: 'claude' | 'fallback' | 'limit';
```

- [ ] **Step 8: Check the allowance in the parse API.** Replace `src/routes/api/parse/+server.ts` with:

```ts
import { error, json } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { DAILY_PARSE_LIMIT, MAX_CAPTURE_LENGTH } from '../../../lib/limits';
import { getParseClient } from '../../../lib/server/parse/client';
import { fallbackResult, parseCapture } from '../../../lib/server/parse/parse';
import { listPiles } from '../../../lib/server/piles';
import { requireUser } from '../../../lib/server/routes';
import { countParse } from '../../../lib/server/usage';
import type { ParseResult } from '../../../lib/types';
import type { RequestHandler } from './$types';

const bodySchema = z.object({ text: z.string().trim().min(1).max(MAX_CAPTURE_LENGTH) });

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireUser(locals);
	const body = bodySchema.safeParse(await request.json().catch(() => null));
	if (!body.success) error(400, `Text must be 1–${MAX_CAPTURE_LENGTH} characters`);

	// Admins aren't counted. Everyone else gets DAILY_PARSE_LIMIT sorts a UTC day; past that the
	// capture still works, without Claude.
	if (!locals.isAdmin && (await countParse(locals.db, user.id)) > DAILY_PARSE_LIMIT) {
		return json({ ...fallbackResult(body.data.text), source: 'limit' } satisfies ParseResult);
	}

	const piles = await listPiles(locals.db, user.id);
	const client = getParseClient(env.ANTHROPIC_API_KEY);
	return json(await parseCapture(client, body.data.text, piles));
};
```

If `src/lib/types.ts` isn't reachable by that relative path, check where `ParseResult` is imported from in `src/lib/server/parse/parse.ts` (`../../types`) and use the matching path from the route: `../../../lib/types`.

- [ ] **Step 9: Show the notice.** In `src/lib/components/CaptureBox.svelte`:
- Add `DAILY_PARSE_LIMIT` to the existing `from '../limits'` import.
- In `showPreview`, replace the `notice = …` statement with:

```ts
		notice =
			result.source === 'limit'
				? `You've used today's ${DAILY_PARSE_LIMIT} Claude sorts. Pick a pile yourself; sorting is back tomorrow.`
				: result.source === 'fallback'
					? "Couldn't sort this one automatically — pick a pile."
					: null;
```

A `'limit'` result has `pile: null`, so `pileChoice` is `''` and Save stays disabled until a pile is picked, exactly as for `'fallback'`.

- [ ] **Step 10: Run the tests and check they pass.**

Run: `npx playwright test e2e/capture.test.ts`
Expected: PASS, including "daily allowance".

- [ ] **Step 11: Run everything and commit.**

```bash
npx vitest run && npm run lint && npm run check && npx playwright test
git add src/lib/server/usage.ts src/lib/server/usage.test.ts src/lib/limits.ts src/lib/types.ts src/routes/api/parse/+server.ts src/lib/components/CaptureBox.svelte e2e/helpers.ts e2e/capture.test.ts
git commit -m "feat: daily allowance of 20 Claude sorts per non-admin user"
```

---

### Task 7: Docs

**Files:**
- Modify: `README.md`, `docs/marketing.md`, `CLAUDE.md`

- [ ] **Step 1: README.** After the "First deploy" section in `README.md`, add a section:

```markdown
## Inviting people

Sign-up is invite-only. Log in with an account listed in `ADMIN_EMAILS` (`wrangler.toml`
`[vars]`), open **Invites** in the header, and choose **Create invite link**. Each link works
once and expires after 14 days. Send it to the person; they create their account from it.

Everyone except admins gets 20 Claude sorts a day (`DAILY_PARSE_LIMIT` in `src/lib/limits.ts`,
resetting at midnight UTC). Past that, captures still work: the preview asks them to pick the
pile. Keep a monthly spend limit on the Anthropic workspace as a backstop.
```

- [ ] **Step 2: Marketing.** In `docs/marketing.md`, in the press release's **Availability** paragraph, replace `Sign-up takes an email and a password.` with `Sign-up is by invitation during early access.` In **Messaging guidelines**, add the bullet:

```markdown
- Butterfly Net is invite-only. Don't invite readers to "sign up now".
```

- [ ] **Step 3: CLAUDE.md.** In `CLAUDE.md`, append to **Rules for this repo**:

```markdown
- Sign-up is invite-only (`/invites`, admins from `ADMIN_EMAILS` in `wrangler.toml`), and
  non-admins get `DAILY_PARSE_LIMIT` Claude sorts a day. A live smoke check on production needs
  an invite link from Gary.
```

- [ ] **Step 4: Check and commit.**

```bash
npm run lint
git add README.md docs/marketing.md CLAUDE.md
git commit -m "docs: invite-only sign-up and the daily Claude allowance"
```

---

## Release (after the PR merges; Gary confirms first)

1. Tagging `v0.4.0` triggers the deploy workflow. It runs `d1 migrations apply butterfly-net-db --remote` (creating `invites` and `parse_usage`), then deploys the Worker, with `ADMIN_EMAILS` coming from `wrangler.toml`.
2. Check the live site:
   - log in as gary.m.gealy@gmail.com
   - the header shows **Invites**, and creating a link works
   - `/signup` with no code shows the invite-only message
3. Revoke the test link.
