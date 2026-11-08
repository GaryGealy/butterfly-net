import { and, asc, desc, eq } from 'drizzle-orm';
import { MAX_SUBTASKS } from '../limits';
import type { Db } from './db';
import { cards, piles, subtasks } from './db/schema';
import { NotFoundError } from './errors';
import { sameStepText } from './links';
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

async function requireCardId(db: Db, userId: string, cardId: string): Promise<void> {
	const [card] = await db
		.select({ id: cards.id })
		.from(cards)
		.where(ownCard(userId, cardId))
		.limit(1);
	if (!card) throw new NotFoundError('card');
}

// D1 caps a statement at 100 bound parameters; ~5 per row, so insert in small chunks.
const SUBTASK_INSERT_CHUNK = 15;

async function insertSubtasks(
	db: Db,
	cardId: string,
	items: SubtaskInput[],
	firstOrder = 0
): Promise<void> {
	for (let start = 0; start < items.length; start += SUBTASK_INSERT_CHUNK) {
		const chunk = items.slice(start, start + SUBTASK_INSERT_CHUNK);
		await db.insert(subtasks).values(
			chunk.map((item, i) => ({
				card_id: cardId,
				text: item.text,
				done: item.done,
				url: item.url ?? null,
				link_title: item.url ? (item.linkTitle ?? null) : null,
				sort_order: firstOrder + start + i
			}))
		);
	}
}

async function listSubtasks(db: Db, cardId: string): Promise<Subtask[]> {
	return db
		.select({
			id: subtasks.id,
			text: subtasks.text,
			done: subtasks.done,
			url: subtasks.url,
			linkTitle: subtasks.link_title
		})
		.from(subtasks)
		.where(eq(subtasks.card_id, cardId))
		.orderBy(asc(subtasks.sort_order));
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

	return { ...row, subtasks: await listSubtasks(db, cardId) };
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

/**
 * Adds steps after a card's subtasks, not done. Steps that repeat an existing subtask or an
 * earlier step are skipped, and only as many as fit under MAX_SUBTASKS are kept. Returns the
 * card's whole subtask list.
 */
export async function appendSubtasks(
	db: Db,
	userId: string,
	cardId: string,
	steps: NewStep[]
): Promise<Subtask[]> {
	await requireCardId(db, userId, cardId);
	const existing = await listSubtasks(db, cardId);
	const seen = existing.map((s) => s.text);
	const fresh: SubtaskInput[] = [];
	for (const step of steps) {
		if (seen.some((text) => sameStepText(text, step.text))) continue;
		seen.push(step.text);
		fresh.push({ ...step, done: false });
	}
	const room = Math.max(0, MAX_SUBTASKS - existing.length);
	const kept = fresh.slice(0, room);
	if (kept.length === 0) return existing;

	const [last] = await db
		.select({ sort_order: subtasks.sort_order })
		.from(subtasks)
		.where(eq(subtasks.card_id, cardId))
		.orderBy(desc(subtasks.sort_order))
		.limit(1);
	await insertSubtasks(db, cardId, kept, last ? last.sort_order + 1 : 0);
	await reindexCard(db, cardId);
	return listSubtasks(db, cardId);
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
