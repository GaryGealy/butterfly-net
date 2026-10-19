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
