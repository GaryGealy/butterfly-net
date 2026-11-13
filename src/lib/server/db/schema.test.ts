import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { searchCards } from '../search';
import { createTestDb, createTestUser } from '../test/db';
import { allSql } from './raw';
import * as schema from './schema';
import { piles } from './schema';
import { withBatch } from './sqlite-batch';

/** A drizzle folder holding only the migrations up to and including `lastTag`. */
function migrationsThrough(lastTag: string): string {
	const dir = mkdtempSync(join(tmpdir(), 'migrations-'));
	const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'));
	const last = journal.entries.findIndex((e: { tag: string }) => e.tag === lastTag);
	journal.entries = journal.entries.slice(0, last + 1);
	cpSync('drizzle/meta', join(dir, 'meta'), { recursive: true });
	writeFileSync(join(dir, 'meta/_journal.json'), JSON.stringify(journal));
	for (const entry of journal.entries)
		cpSync(`drizzle/${entry.tag}.sql`, join(dir, `${entry.tag}.sql`));
	return dir;
}

describe('migrations', () => {
	it('create every table, including the cards_fts search index', async () => {
		const db = createTestDb();
		const rows = await allSql<{ name: string }>(
			db,
			sql`SELECT name FROM sqlite_master WHERE type = 'table'`
		);
		const names = rows.map((r) => r.name);
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

	it('creates subtasks_card_order_idx, cards_pile_idx and cards_search_id_idx', async () => {
		const db = createTestDb();
		const rows = await allSql<{ name: string; sql: string }>(
			db,
			sql`SELECT name, sql FROM sqlite_master WHERE type = 'index'`
		);
		const byName = new Map(rows.map((r) => [r.name, r.sql]));
		expect(byName.get('subtasks_card_order_idx')).toMatch(/\(`card_id`,\s*`sort_order`\)/);
		expect(byName.get('cards_pile_idx')).toMatch(/\(`pile_id`\)/);
		expect(byName.get('cards_search_id_idx')).toMatch(/CREATE UNIQUE INDEX.*\(`search_id`\)/);
	});

	it('migrating a database seeded at 0003 makes every existing card searchable by title and subtask', async () => {
		const old = migrationsThrough('0003_naive_true_believers');
		const sqlite = new Database(':memory:');
		sqlite.pragma('foreign_keys = ON');
		const local = drizzle(sqlite, { schema });
		try {
			migrate(local, { migrationsFolder: old });
			sqlite.exec(`
				INSERT INTO users (id, email, password_hash, created_at) VALUES ('u1', 'a@test.dev', 'x', 0);
				INSERT INTO piles (id, user_id, name, sort_order, created_at) VALUES ('p1', 'u1', 'house', 0, 0);
				INSERT INTO cards (id, user_id, pile_id, title, notes, status, created_at)
					VALUES ('c1', 'u1', 'p1', 'Replace furnace filters', NULL, 'active', 0),
					       ('c2', 'u1', 'p1', 'Clean gutters', 'before winter', 'done', 1);
				INSERT INTO subtasks (id, card_id, text, done, sort_order)
					VALUES ('s1', 'c1', 'measure the slot', 0, 1),
					       ('s2', 'c1', 'buy merv filters', 0, 0),
					       ('s3', 'c2', 'borrow a ladder', 1, 0);
				INSERT INTO cards_fts (card_id, user_id, title, notes, subtasks)
					VALUES ('c1', 'u1', 'Replace furnace filters', '', 'buy merv filters');
			`);

			migrate(local, { migrationsFolder: 'drizzle' });
			const db = withBatch(sqlite, local);

			expect((await searchCards(db, 'u1', 'furnace')).map((r) => r.id)).toEqual(['c1']);
			expect((await searchCards(db, 'u1', 'measure')).map((r) => r.id)).toEqual(['c1']);
			expect((await searchCards(db, 'u1', 'ladder')).map((r) => r.id)).toEqual(['c2']);
			expect((await searchCards(db, 'u1', 'winter')).map((r) => r.id)).toEqual(['c2']);
			expect(
				sqlite
					.prepare(
						'SELECT f.rowid = c.search_id AS keyed, f.subtasks FROM cards_fts f JOIN cards c ON c.id = f.card_id ORDER BY c.id'
					)
					.all()
			).toEqual([
				{ keyed: 1, subtasks: 'buy merv filters\nmeasure the slot' },
				{ keyed: 1, subtasks: 'borrow a ladder' }
			]);
		} finally {
			sqlite.close();
			rmSync(old, { recursive: true, force: true });
		}
	});
});
