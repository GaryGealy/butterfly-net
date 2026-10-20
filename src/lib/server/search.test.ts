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

		expect((await searchCards(db, userId, 'x-wing')).map((r) => r.title)).toEqual([
			'Paint the X-wing'
		]);
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
