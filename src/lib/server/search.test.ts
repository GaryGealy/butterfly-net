import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { appendSubtasks, createCard, markDone, saveCard } from './cards';
import type { Db } from './db';
import { allSql } from './db/raw';
import { cards } from './db/schema';
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
	createCard(db, userId, { title, notes, subtasks, pile: { kind: 'existing', id: pileId } });

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

	it('after saveCard, finds the new subtask text and not the removed one', async () => {
		const id = await add('Paint the X-wing', null, ['prime the hull']);
		await saveCard(db, userId, id, { title: 'Paint the X-wing', notes: null, pileId }, [
			{ text: 'weather the panels', done: false }
		]);
		expect((await searchCards(db, userId, 'weather')).map((r) => r.id)).toEqual([id]);
		expect(await searchCards(db, userId, 'prime')).toEqual([]);
	});

	it('each card has exactly one cards_fts row after create, save, save again, and append', async () => {
		const id = await add('Paint the X-wing', null, ['prime the hull']);
		const edit = { title: 'Paint the X-wing', notes: null, pileId };
		await saveCard(db, userId, id, edit, [{ text: 'weather the panels', done: false }]);
		await saveCard(db, userId, id, edit, [{ text: 'seal the decals', done: false }]);
		await appendSubtasks(db, userId, id, [{ text: 'mount on base', url: null, linkTitle: null }]);

		const rows = await allSql<{ subtasks: string }>(
			db,
			sql`SELECT subtasks FROM cards_fts WHERE card_id = ${id}`
		);
		expect(rows).toEqual([{ subtasks: 'seal the decals\nmount on base' }]);
		expect((await searchCards(db, userId, 'mount')).map((r) => r.id)).toEqual([id]);
	});

	it('new cards get increasing, unique search_ids', async () => {
		const ids = [await add('one'), await add('two'), await add('three')];
		const rows = await db
			.select({ id: cards.id, search_id: cards.search_id })
			.from(cards)
			.orderBy(cards.search_id);
		expect(rows.map((r) => r.id)).toEqual(ids);
		expect(rows.map((r) => r.search_id)).toEqual([1, 2, 3]);
		const fts = await allSql<{ rowid: number; card_id: string }>(
			db,
			sql`SELECT rowid, card_id FROM cards_fts ORDER BY rowid`
		);
		expect(fts).toEqual(rows.map((r) => ({ rowid: r.search_id, card_id: r.id })));
	});
});
