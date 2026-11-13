import { and, asc, desc, eq, getTableColumns, gte, sql } from 'drizzle-orm';
import { MAX_SUBTASKS } from '../limits';
import type { Db } from './db';
import { cards, piles, subtasks } from './db/schema';
import { NotFoundError } from './errors';
import { sameStepText } from './links';
import { getPile, listPiles, type Pile } from './piles';
import type { CaptureSave } from './validation';
import { ftsDelete, ftsInsert, nextSearchId } from './search-index';

export interface NewCard {
	title: string;
	notes: string | null;
	subtasks: string[];
	/** An existing pile, or a new one; a "new" name matching a pile in any case reuses it. */
	pile: CaptureSave['pile'];
}

export interface CardEdit {
	title: string;
	notes: string | null;
	pileId: string;
}

export interface SubtaskInput {
	text: string;
	done: boolean;
	url?: string | null;
	linkTitle?: string | null;
}

export interface Subtask {
	id: string;
	text: string;
	done: boolean;
	url: string | null;
	linkTitle: string | null;
}

/** A step to append to a card, as Break it down proposes it. */
export interface NewStep {
	text: string;
	url: string | null;
	linkTitle: string | null;
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

// D1 caps a statement at 100 bound parameters, and every subtask column is bound per row
// (the id default included), so the chunk size follows the column count.
const SUBTASK_INSERT_CHUNK = Math.floor(100 / Object.keys(getTableColumns(subtasks)).length);

function subtaskInserts(db: Db, cardId: string, items: SubtaskInput[], firstOrder = 0) {
	const inserts = [];
	for (let start = 0; start < items.length; start += SUBTASK_INSERT_CHUNK) {
		const chunk = items.slice(start, start + SUBTASK_INSERT_CHUNK);
		inserts.push(
			db.insert(subtasks).values(
				chunk.map((item, i) => ({
					card_id: cardId,
					text: item.text,
					done: item.done,
					url: item.url ?? null,
					link_title: item.url ? (item.linkTitle ?? null) : null,
					sort_order: firstOrder + start + i
				}))
			)
		);
	}
	return inserts;
}

function listSubtasks(db: Db, cardId: string, fromOrder = 0) {
	return db
		.select({
			id: subtasks.id,
			text: subtasks.text,
			done: subtasks.done,
			url: subtasks.url,
			linkTitle: subtasks.link_title
		})
		.from(subtasks)
		.where(and(eq(subtasks.card_id, cardId), gte(subtasks.sort_order, fromOrder)))
		.orderBy(asc(subtasks.sort_order));
}

const ownedPile = (db: Db, userId: string, pileId: string) =>
	db
		.select({ id: piles.id })
		.from(piles)
		.where(and(eq(piles.id, pileId), eq(piles.user_id, userId)))
		.limit(1);

export async function createCard(db: Db, userId: string, input: NewCard): Promise<string> {
	let pileId: string;
	let newPile: { id: string; name: string; sort_order: number } | null = null;
	if (input.pile.kind === 'existing') {
		const [pile] = await ownedPile(db, userId, input.pile.id);
		if (!pile) throw new NotFoundError('pile');
		pileId = pile.id;
	} else {
		const name = input.pile.name.trim();
		const [[match], [{ max }]] = await db.batch([
			db
				.select({ id: piles.id })
				.from(piles)
				.where(and(eq(piles.user_id, userId), sql`lower(${piles.name}) = lower(${name})`))
				.limit(1),
			db
				.select({ max: sql<number | null>`max(${piles.sort_order})` })
				.from(piles)
				.where(eq(piles.user_id, userId))
		]);
		if (match) {
			pileId = match.id;
		} else {
			newPile = { id: crypto.randomUUID(), name, sort_order: (max ?? -1) + 1 };
			pileId = newPile.id;
		}
	}

	const cardId = crypto.randomUUID();
	const cardInsert = db.insert(cards).values({
		id: cardId,
		user_id: userId,
		pile_id: pileId,
		title: input.title,
		notes: input.notes,
		search_id: nextSearchId
	});
	const rest = [
		...subtaskInserts(
			db,
			cardId,
			input.subtasks.map((text) => ({ text, done: false }))
		),
		ftsInsert(db, { id: cardId, userId, title: input.title, notes: input.notes }, input.subtasks)
	];
	if (newPile) {
		await db.batch([db.insert(piles).values({ ...newPile, user_id: userId }), cardInsert, ...rest]);
	} else {
		await db.batch([cardInsert, ...rest]);
	}
	return cardId;
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

	return { ...row, subtasks: await listSubtasks(db, cardId) };
}

/** Saves the card page: title, notes, pile and the full subtask list, all or nothing. */
export async function saveCard(
	db: Db,
	userId: string,
	cardId: string,
	edit: CardEdit,
	items: SubtaskInput[]
): Promise<void> {
	const [[card], [pile]] = await db.batch([
		db.select({ id: cards.id }).from(cards).where(ownCard(userId, cardId)).limit(1),
		ownedPile(db, userId, edit.pileId)
	]);
	if (!card) throw new NotFoundError('card');
	if (!pile) throw new NotFoundError('pile');

	await db.batch([
		db
			.update(cards)
			.set({ title: edit.title, notes: edit.notes, pile_id: pile.id })
			.where(ownCard(userId, cardId)),
		db.delete(subtasks).where(eq(subtasks.card_id, cardId)),
		...subtaskInserts(db, cardId, items),
		ftsDelete(db, cardId),
		ftsInsert(
			db,
			{ id: cardId, userId, title: edit.title, notes: edit.notes },
			items.map((item) => item.text)
		)
	]);
}

/** Moves a card to another of the user's piles; returns the pile it came from, for Undo. */
export async function moveCard(
	db: Db,
	userId: string,
	cardId: string,
	pileId: string
): Promise<string> {
	const [card] = await db
		.select({ pile_id: cards.pile_id })
		.from(cards)
		.where(ownCard(userId, cardId))
		.limit(1);
	if (!card) throw new NotFoundError('card');
	const pile = await requirePile(db, userId, pileId);
	await db.update(cards).set({ pile_id: pile.id }).where(ownCard(userId, cardId));
	return card.pile_id;
}

/**
 * Adds steps after a card's subtasks, not done. Steps that repeat an existing subtask or an
 * earlier step are skipped, and only as many as fit under MAX_SUBTASKS are kept. Returns only
 * the rows it inserted, so the card page can append exactly those.
 */
export async function appendSubtasks(
	db: Db,
	userId: string,
	cardId: string,
	steps: NewStep[]
): Promise<Subtask[]> {
	const [[card], existing] = await db.batch([
		db
			.select({ title: cards.title, notes: cards.notes })
			.from(cards)
			.where(ownCard(userId, cardId))
			.limit(1),
		db
			.select({ text: subtasks.text, sort_order: subtasks.sort_order })
			.from(subtasks)
			.where(eq(subtasks.card_id, cardId))
			.orderBy(asc(subtasks.sort_order))
	]);
	if (!card) throw new NotFoundError('card');

	const seen = existing.map((s) => s.text);
	const fresh: SubtaskInput[] = [];
	for (const step of steps) {
		if (seen.some((text) => sameStepText(text, step.text))) continue;
		seen.push(step.text);
		fresh.push({ ...step, done: false });
	}
	const room = Math.max(0, MAX_SUBTASKS - existing.length);
	const kept = fresh.slice(0, room);
	if (kept.length === 0) return [];

	const firstOrder = existing.length > 0 ? existing[existing.length - 1].sort_order + 1 : 0;
	const [, ...results] = await db.batch([
		ftsDelete(db, cardId),
		ftsInsert(db, { id: cardId, userId, title: card.title, notes: card.notes }, [
			...existing.map((s) => s.text),
			...kept.map((s) => s.text)
		]),
		...subtaskInserts(db, cardId, kept, firstOrder),
		listSubtasks(db, cardId, firstOrder)
	]);
	return results.at(-1) as Subtask[];
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
	const [card] = await db
		.select({ id: cards.id })
		.from(cards)
		.where(ownCard(userId, cardId))
		.limit(1);
	if (!card) throw new NotFoundError('card');
	await db.batch([
		ftsDelete(db, cardId),
		db.delete(subtasks).where(eq(subtasks.card_id, cardId)),
		db.delete(cards).where(ownCard(userId, cardId))
	]);
}

export async function listActiveCardsByPile(db: Db, userId: string): Promise<PileWithCards[]> {
	const pileList = await listPiles(db, userId);
	const active = await db
		.select({
			id: cards.id,
			title: cards.title,
			pile_id: cards.pile_id,
			created_at: cards.created_at
		})
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
