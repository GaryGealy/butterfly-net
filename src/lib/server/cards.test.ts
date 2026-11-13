import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import {
	appendSubtasks,
	cardPageData,
	createCard,
	deleteCard,
	getCard,
	listActiveCardsByPile,
	listArchivedCards,
	markDone,
	moveCard,
	reopenCard,
	saveCard,
	type NewCard
} from './cards';
import type { Db } from './db';
import { allSql } from './db/raw';
import { NotFoundError } from './errors';
import { listPiles, seedDefaultPiles, type Pile } from './piles';
import { searchCards } from './search';
import { createTestDb, createTestUser } from './test/db';
import { countParse } from './usage';

const newId = () => crypto.randomUUID();

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

const newCard = ({
	pileId = house.id,
	...overrides
}: Partial<Omit<NewCard, 'pile'>> & { pileId?: string } = {}): NewCard => ({
	title: 'Fix the gate latch',
	notes: null,
	subtasks: [],
	pile: { kind: 'existing', id: pileId },
	...overrides
});

const countRows = async (table: 'piles' | 'cards' | 'subtasks' | 'cards_fts') =>
	(await allSql<{ n: number }>(db, sql`SELECT count(*) AS n FROM ${sql.identifier(table)}`))[0].n;

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

	it('files the card on an existing pile', async () => {
		const id = await createCard(db, userId, newCard({ pileId: ideas.id }));
		expect((await getCard(db, userId, id))?.pile_name).toBe('ideas');
	});

	it('createCard onto a new pile creates the pile, card, subtasks and index row together', async () => {
		const id = await createCard(db, userId, {
			...newCard({ subtasks: ['dig a bed', 'buy seedlings'] }),
			pile: { kind: 'new', name: ' garden ' }
		});
		const piles = await listPiles(db, userId);
		expect(piles.map((p) => [p.name, p.sort_order]).at(-1)).toEqual(['garden', 5]);
		const card = await getCard(db, userId, id);
		expect(card?.pile_name).toBe('garden');
		expect(card?.subtasks.map((s) => s.text)).toEqual(['dig a bed', 'buy seedlings']);
		expect((await searchCards(db, userId, 'seedlings')).map((r) => r.id)).toEqual([id]);
	});

	it('createCard with a new pile name matching an existing pile (any case) uses that pile', async () => {
		const id = await createCard(db, userId, { ...newCard(), pile: { kind: 'new', name: 'IDEAS' } });
		expect(await listPiles(db, userId)).toHaveLength(5);
		expect((await getCard(db, userId, id))?.pile_id).toBe(ideas.id);
	});

	it("createCard onto another user's pile throws NotFoundError and creates nothing", async () => {
		const other = await createTestUser(db);
		await seedDefaultPiles(db, other);
		const [theirs] = await listPiles(db, other);
		const before = [
			await countRows('cards'),
			await countRows('subtasks'),
			await countRows('cards_fts')
		];
		await expect(
			createCard(db, userId, newCard({ pileId: theirs.id, subtasks: ['x'] }))
		).rejects.toBeInstanceOf(NotFoundError);
		expect([
			await countRows('cards'),
			await countRows('subtasks'),
			await countRows('cards_fts')
		]).toEqual(before);
	});

	it("cardPageData returns the card, its subtasks, every pile and today's sorts used", async () => {
		const id = await createCard(db, userId, newCard({ subtasks: ['Buy latch'] }));
		await countParse(db, userId);
		await countParse(db, userId);
		const data = await cardPageData(db, userId, id);
		expect(data?.card).toEqual(await getCard(db, userId, id));
		expect(data?.piles).toEqual(await listPiles(db, userId));
		expect(data?.used).toBe(2);
		expect(await cardPageData(db, userId, newId())).toBeNull();
		expect(await cardPageData(db, await createTestUser(db), id)).toBeNull();
	});

	it("returns null for another user's card", async () => {
		const id = await createCard(db, userId, newCard());
		const other = await createTestUser(db);
		expect(await getCard(db, other, id)).toBeNull();
	});
});

describe('subtasks and ownership', () => {
	it('keeps 50 subtasks in order across insert chunks', async () => {
		const texts = Array.from({ length: 50 }, (_, i) => `task ${i}`);
		const id = await createCard(db, userId, newCard({ subtasks: texts }));
		const card = await getCard(db, userId, id);
		expect(card?.subtasks.map((s) => s.text)).toEqual(texts);
		const rows = await allSql<{ sort_order: number }>(
			db,
			sql`SELECT sort_order FROM subtasks WHERE card_id = ${id} ORDER BY sort_order`
		);
		expect(rows.map((r) => r.sort_order)).toEqual(texts.map((_, i) => i));
	});

	it('reindexes subtasks in the search index on save', async () => {
		const id = await createCard(db, userId, newCard({ subtasks: ['old'] }));
		const q = sql`SELECT subtasks FROM cards_fts WHERE card_id = ${id}`;
		expect(await allSql(db, q)).toEqual([{ subtasks: 'old' }]);
		await saveCard(db, userId, id, { title: 'Fix the gate latch', notes: null, pileId: house.id }, [
			{ text: 'alpha', done: false },
			{ text: 'beta', done: true }
		]);
		expect(await allSql(db, q)).toEqual([{ subtasks: 'alpha\nbeta' }]);
	});

	it('keeps a link on a subtask, and none when it is omitted', async () => {
		const id = await createCard(db, userId, newCard());
		await saveCard(db, userId, id, { title: 'Fix the gate latch', notes: null, pileId: house.id }, [
			{ text: 'Watch', done: false, url: 'https://x.dev/v', linkTitle: 'A video' },
			{ text: 'Sketch', done: true }
		]);
		const card = await getCard(db, userId, id);
		expect(card?.subtasks.map(({ text, url, linkTitle }) => ({ text, url, linkTitle }))).toEqual([
			{ text: 'Watch', url: 'https://x.dev/v', linkTitle: 'A video' },
			{ text: 'Sketch', url: null, linkTitle: null }
		]);
	});

	it("changes nothing on another user's card", async () => {
		const id = await createCard(db, userId, newCard({ subtasks: ['mine'] }));
		const other = await createTestUser(db);
		await expect(
			saveCard(db, other, id, { title: 'hijacked', notes: null, pileId: house.id }, [])
		).rejects.toThrow(NotFoundError);
		await expect(markDone(db, other, id)).rejects.toThrow(NotFoundError);
		await expect(deleteCard(db, other, id)).rejects.toThrow(NotFoundError);
		expect(await getCard(db, userId, id)).toMatchObject({
			title: 'Fix the gate latch',
			status: 'active'
		});
		expect((await getCard(db, userId, id))?.subtasks.map((s) => s.text)).toEqual(['mine']);
		const fts = await allSql(db, sql`SELECT subtasks FROM cards_fts WHERE card_id = ${id}`);
		expect(fts).toEqual([{ subtasks: 'mine' }]);
	});
});

describe('saveCard', () => {
	const steps = (...texts: string[]) => texts.map((text) => ({ text, done: false }));

	it('replaces title, notes, pile and subtasks together', async () => {
		const id = await createCard(db, userId, newCard({ subtasks: ['old'] }));
		await saveCard(
			db,
			userId,
			id,
			{ title: 'Replace the gate', notes: 'Cedar', pileId: ideas.id },
			[
				{ text: 'first', done: true },
				{ text: 'second', done: false, url: 'https://example.com', linkTitle: 'Example' }
			]
		);
		const card = await getCard(db, userId, id);
		expect(card).toMatchObject({ title: 'Replace the gate', notes: 'Cedar', pile_name: 'ideas' });
		expect(card?.subtasks.map((s) => [s.text, s.done, s.url, s.linkTitle])).toEqual([
			['first', true, null, null],
			['second', false, 'https://example.com', 'Example']
		]);
	});

	it("throws NotFoundError for another user's card and changes nothing", async () => {
		const id = await createCard(db, userId, newCard({ subtasks: ['keep'] }));
		const intruder = await createTestUser(db);
		await expect(
			saveCard(db, intruder, id, { title: 'Hijacked', notes: null, pileId: house.id }, [])
		).rejects.toBeInstanceOf(NotFoundError);
		const card = await getCard(db, userId, id);
		expect(card?.title).toBe('Fix the gate latch');
		expect(card?.subtasks.map((s) => s.text)).toEqual(['keep']);
	});

	it("throws NotFoundError for another user's pile and changes nothing", async () => {
		const id = await createCard(db, userId, newCard());
		const other = await createTestUser(db);
		await seedDefaultPiles(db, other);
		const [theirs] = await listPiles(db, other);
		await expect(
			saveCard(db, userId, id, { title: 'Moved', notes: null, pileId: theirs.id }, [])
		).rejects.toBeInstanceOf(NotFoundError);
		expect((await getCard(db, userId, id))?.pile_name).toBe('house');
	});

	it('keeps the old subtasks when the write batch fails midway', async () => {
		const id = await createCard(db, userId, newCard({ subtasks: ['keep me'] }));
		await db.run(sql`DROP TABLE cards_fts`);
		await expect(
			saveCard(db, userId, id, { title: 'Changed', notes: null, pileId: house.id }, steps('new'))
		).rejects.toThrow();
		const card = await getCard(db, userId, id);
		expect(card?.title).toBe('Fix the gate latch');
		expect(card?.subtasks.map((s) => s.text)).toEqual(['keep me']);
	});

	it('saves 20 subtasks', async () => {
		const id = await createCard(db, userId, newCard());
		const twenty = steps(...Array.from({ length: 20 }, (_, i) => `step ${i + 1}`));
		await saveCard(db, userId, id, { title: 'Many', notes: null, pileId: house.id }, twenty);
		expect((await getCard(db, userId, id))?.subtasks).toHaveLength(20);
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

	it('deleteCard removes the card, its subtasks and its index row', async () => {
		const keep = await createCard(db, userId, newCard({ title: 'keep', subtasks: ['b'] }));
		const id = await createCard(db, userId, newCard({ subtasks: ['a', 'c'] }));
		await deleteCard(db, userId, id);
		expect(await getCard(db, userId, id)).toBeNull();
		const left = await allSql<{ card_id: string }>(db, sql`SELECT card_id FROM subtasks`);
		expect(left.map((r) => r.card_id)).toEqual([keep]);
		const indexed = await allSql<{ card_id: string }>(db, sql`SELECT card_id FROM cards_fts`);
		expect(indexed.map((r) => r.card_id)).toEqual([keep]);
	});

	it('deleteCard throws NotFoundError for a missing card', async () => {
		await expect(deleteCard(db, userId, 'no-such-card')).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe('moveCard', () => {
	it('moves a card to another pile, keeping everything else, and says where it was', async () => {
		const id = await createCard(
			db,
			userId,
			newCard({ notes: 'by the shed', subtasks: ['buy a latch'] })
		);
		expect(await moveCard(db, userId, id, ideas.id)).toBe(house.id);
		expect(await getCard(db, userId, id)).toMatchObject({
			pile_id: ideas.id,
			title: 'Fix the gate latch',
			notes: 'by the shed',
			status: 'active'
		});
		expect((await getCard(db, userId, id))?.subtasks.map((s) => s.text)).toEqual(['buy a latch']);
	});

	it("refuses another user's pile and another user's card", async () => {
		const id = await createCard(db, userId, newCard());
		const other = await createTestUser(db);
		await seedDefaultPiles(db, other);
		const [theirs] = await listPiles(db, other);
		await expect(moveCard(db, userId, id, theirs.id)).rejects.toThrow(NotFoundError);
		await expect(moveCard(db, other, id, theirs.id)).rejects.toThrow(NotFoundError);
		await expect(moveCard(db, userId, 'no-such-card', ideas.id)).rejects.toThrow(NotFoundError);
		expect((await getCard(db, userId, id))?.pile_id).toBe(house.id);
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

		await saveCard(db, userId, id, { title: 'New title', notes: null, pileId: house.id }, [
			{ text: 'hinges', done: false }
		]);
		[row] = await allSql<Row>(db, sql`SELECT * FROM cards_fts WHERE card_id = ${id}`);
		expect(row.title).toBe('New title');
		expect(row.notes).toBe('');
	});
});

describe('appendSubtasks', () => {
	const step = (text: string, url: string | null = null, linkTitle: string | null = null) => ({
		text,
		url,
		linkTitle
	});

	it('adds steps after the existing subtasks, not done, with their links', async () => {
		const id = await createCard(db, userId, newCard({ subtasks: ['first'] }));
		await appendSubtasks(db, userId, id, [
			step('Watch an intro', 'https://x.dev/v', 'Intro video'),
			step('Sketch it')
		]);
		const card = await getCard(db, userId, id);
		expect(
			card?.subtasks.map(({ text, done, url, linkTitle }) => ({ text, done, url, linkTitle }))
		).toEqual([
			{ text: 'first', done: false, url: null, linkTitle: null },
			{ text: 'Watch an intro', done: false, url: 'https://x.dev/v', linkTitle: 'Intro video' },
			{ text: 'Sketch it', done: false, url: null, linkTitle: null }
		]);
	});

	it('returns only the rows it inserted', async () => {
		const id = await createCard(db, userId, newCard({ subtasks: ['first'] }));
		const added = await appendSubtasks(db, userId, id, [step('Sketch it')]);
		expect(added.map((s) => s.text)).toEqual(['Sketch it']);
		expect((await getCard(db, userId, id))?.subtasks.slice(1)).toEqual(added);
	});

	it('skips steps that repeat an existing subtask or an earlier step', async () => {
		const id = await createCard(db, userId, newCard({ subtasks: ['Read the paper'] }));
		const added = await appendSubtasks(db, userId, id, [
			step(' read  THE paper '),
			step('Sketch it'),
			step('sketch it')
		]);
		expect(added.map((s) => s.text)).toEqual(['Sketch it']);
		expect((await getCard(db, userId, id))?.subtasks.map((s) => s.text)).toEqual([
			'Read the paper',
			'Sketch it'
		]);
	});

	it('keeps only as many as fit under the subtask limit', async () => {
		const texts = Array.from({ length: 49 }, (_, i) => `task ${i}`);
		const id = await createCard(db, userId, newCard({ subtasks: texts }));
		const added = await appendSubtasks(db, userId, id, [step('a'), step('b'), step('c')]);
		expect(added.map((s) => s.text)).toEqual(['a']);
		expect((await getCard(db, userId, id))?.subtasks).toHaveLength(50);
	});

	it("refuses another user's card", async () => {
		const id = await createCard(db, userId, newCard());
		const other = await createTestUser(db);
		await expect(appendSubtasks(db, other, id, [step('x')])).rejects.toThrow(NotFoundError);
		expect((await getCard(db, userId, id))?.subtasks).toEqual([]);
	});

	it('appendSubtasks returns only the inserted rows and the index includes them', async () => {
		const id = await createCard(db, userId, newCard({ notes: 'cedar', subtasks: ['first'] }));
		const added = await appendSubtasks(db, userId, id, [step('second'), step('third')]);
		const card = await getCard(db, userId, id);
		expect(added).toEqual(card?.subtasks.slice(1));
		expect(added.map((s) => s.text)).toEqual(['second', 'third']);
		const fts = await allSql(
			db,
			sql`SELECT title, notes, subtasks FROM cards_fts WHERE card_id = ${id}`
		);
		expect(fts).toEqual([
			{ title: 'Fix the gate latch', notes: 'cedar', subtasks: 'first\nsecond\nthird' }
		]);
	});

	it('makes the new steps searchable', async () => {
		const id = await createCard(db, userId, newCard());
		await appendSubtasks(db, userId, id, [step('Watch the zeppelin documentary')]);
		expect((await searchCards(db, userId, 'zeppelin')).map((r) => r.id)).toEqual([id]);
	});
});
