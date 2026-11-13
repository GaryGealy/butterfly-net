import { and, asc, count, eq, sql } from 'drizzle-orm';
import type { Db } from './db';
import { cards, piles } from './db/schema';
import { DuplicatePileError, LastPileError, NotFoundError, PileNotEmptyError } from './errors';

export const DEFAULT_PILES = [
	'house',
	'work stuff',
	'ideas',
	'video games',
	'model building'
] as const;

export interface Pile {
	id: string;
	name: string;
	sort_order: number;
}

export interface PileWithCount extends Pile {
	card_count: number;
}

const pileColumns = { id: piles.id, name: piles.name, sort_order: piles.sort_order };

export async function seedDefaultPiles(db: Db, userId: string): Promise<void> {
	await db
		.insert(piles)
		.values(DEFAULT_PILES.map((name, i) => ({ user_id: userId, name, sort_order: i })));
}

/** The user's piles in board order, as a builder so it can go in a batch. */
export function pilesQuery(db: Db, userId: string) {
	return db
		.select(pileColumns)
		.from(piles)
		.where(eq(piles.user_id, userId))
		.orderBy(asc(piles.sort_order));
}

export async function listPiles(db: Db, userId: string): Promise<Pile[]> {
	return pilesQuery(db, userId);
}

export async function listPilesWithCounts(db: Db, userId: string): Promise<PileWithCount[]> {
	return db
		.select({ ...pileColumns, card_count: count(cards.id) })
		.from(piles)
		.leftJoin(cards, eq(cards.pile_id, piles.id))
		.where(eq(piles.user_id, userId))
		.groupBy(piles.id)
		.orderBy(asc(piles.sort_order));
}

export async function getPile(db: Db, userId: string, pileId: string): Promise<Pile | null> {
	const [pile] = await db
		.select(pileColumns)
		.from(piles)
		.where(and(eq(piles.id, pileId), eq(piles.user_id, userId)))
		.limit(1);
	return pile ?? null;
}

export async function findPileByName(db: Db, userId: string, name: string): Promise<Pile | null> {
	const [pile] = await db
		.select(pileColumns)
		.from(piles)
		.where(and(eq(piles.user_id, userId), sql`lower(${piles.name}) = lower(${name.trim()})`))
		.limit(1);
	return pile ?? null;
}

export async function createPile(db: Db, userId: string, name: string): Promise<Pile> {
	const trimmed = name.trim();
	const existing = await findPileByName(db, userId, trimmed);
	if (existing) return existing;

	const [{ max }] = await db
		.select({ max: sql<number | null>`max(${piles.sort_order})` })
		.from(piles)
		.where(eq(piles.user_id, userId));
	const [pile] = await db
		.insert(piles)
		.values({ user_id: userId, name: trimmed, sort_order: (max ?? -1) + 1 })
		.returning(pileColumns);
	return pile;
}

export async function renamePile(
	db: Db,
	userId: string,
	pileId: string,
	name: string
): Promise<void> {
	const trimmed = name.trim();
	const clash = await findPileByName(db, userId, trimmed);
	if (clash && clash.id !== pileId) throw new DuplicatePileError(trimmed);

	const updated = await db
		.update(piles)
		.set({ name: trimmed })
		.where(and(eq(piles.id, pileId), eq(piles.user_id, userId)))
		.returning({ id: piles.id });
	if (updated.length === 0) throw new NotFoundError('pile');
}

export async function movePile(
	db: Db,
	userId: string,
	pileId: string,
	direction: 'up' | 'down'
): Promise<void> {
	const all = await listPiles(db, userId);
	const i = all.findIndex((p) => p.id === pileId);
	if (i === -1) throw new NotFoundError('pile');
	const j = direction === 'up' ? i - 1 : i + 1;
	if (j < 0 || j >= all.length) return;

	const ownPile = (id: string) => and(eq(piles.id, id), eq(piles.user_id, userId));
	await db.batch([
		db.update(piles).set({ sort_order: all[j].sort_order }).where(ownPile(all[i].id)),
		db.update(piles).set({ sort_order: all[i].sort_order }).where(ownPile(all[j].id))
	]);
}

export async function deletePile(
	db: Db,
	userId: string,
	pileId: string,
	reassignToPileId?: string
): Promise<void> {
	const ownPile = (id: string) => and(eq(piles.id, id), eq(piles.user_id, userId));
	const [[pile], [{ piles: pileCount }], [{ n }], [target]] = await db.batch([
		db.select({ id: piles.id }).from(piles).where(ownPile(pileId)).limit(1),
		db.select({ piles: count() }).from(piles).where(eq(piles.user_id, userId)),
		// Counts archived cards too: they still reference this pile.
		db
			.select({ n: count() })
			.from(cards)
			.where(and(eq(cards.pile_id, pileId), eq(cards.user_id, userId))),
		db
			.select({ id: piles.id })
			.from(piles)
			.where(ownPile(reassignToPileId ?? ''))
			.limit(1)
	]);
	if (!pile) throw new NotFoundError('pile');
	// Captures need somewhere to land, and the preview can't create a pile when Claude is down.
	if (pileCount <= 1) throw new LastPileError();

	const deletePileRow = db.delete(piles).where(ownPile(pileId));
	if (n === 0) {
		await deletePileRow;
		return;
	}
	if (!reassignToPileId || reassignToPileId === pileId) throw new PileNotEmptyError(n);
	if (!target) throw new NotFoundError('pile');
	await db.batch([
		db
			.update(cards)
			.set({ pile_id: target.id })
			.where(and(eq(cards.pile_id, pileId), eq(cards.user_id, userId))),
		deletePileRow
	]);
}
