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
		await updateCard(db, userId, id, {
			title: 'Replace the gate',
			notes: 'Cedar',
			pileId: ideas.id
		});
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
		expect(await getCard(db, userId, id)).toMatchObject({
			title: 'Fix the gate latch',
			status: 'active'
		});
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
		const id = await createCard(
			db,
			userId,
			newCard({ notes: 'cedar boards', subtasks: ['hinges'] })
		);
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
