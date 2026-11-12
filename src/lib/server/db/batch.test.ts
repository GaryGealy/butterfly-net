import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, createTestUser } from '../test/db';
import type { Db } from './index';
import { cards, piles } from './schema';

let db: Db;
let userId: string;

beforeEach(async () => {
	db = createTestDb();
	userId = await createTestUser(db);
});

describe('db.batch on the local driver', () => {
	it('returns select rows and returning rows in statement order', async () => {
		const [inserted, rows] = await db.batch([
			db
				.insert(piles)
				.values({ id: 'p1', user_id: userId, name: 'house', sort_order: 0 })
				.returning({ id: piles.id }),
			db.select({ name: piles.name }).from(piles).where(eq(piles.user_id, userId))
		]);
		expect(inserted).toEqual([{ id: 'p1' }]);
		expect(rows).toEqual([{ name: 'house' }]);
	});

	it('runs plain writes and resolves', async () => {
		await db.batch([
			db.insert(piles).values({ id: 'p1', user_id: userId, name: 'house', sort_order: 0 }),
			db.update(piles).set({ name: 'home' }).where(eq(piles.id, 'p1'))
		]);
		const [pile] = await db.select({ name: piles.name }).from(piles);
		expect(pile.name).toBe('home');
	});

	it('rolls back earlier statements when a later one fails', async () => {
		await expect(
			db.batch([
				db.insert(piles).values({ id: 'p1', user_id: userId, name: 'house', sort_order: 0 }),
				// pile_id references a pile that doesn't exist: FK violation.
				db.insert(cards).values({ user_id: userId, pile_id: 'missing', title: 'x' })
			])
		).rejects.toThrow();
		expect(await db.select().from(piles)).toEqual([]);
	});
});
