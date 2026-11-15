import { eq, sql } from 'drizzle-orm';
import type { Db } from './db';
import { cardsFts } from './db/fts';
import { cards } from './db/schema';

export interface IndexedCard {
	id: string;
	userId: string;
	title: string;
	notes: string | null;
}

/** A card's cards_fts rowid. Inside a batch, use it before any statement that deletes the card. */
const searchIdOf = (cardId: string) =>
	sql<number>`(SELECT ${cards.search_id} FROM ${cards} WHERE ${cards.id} = ${cardId})`;

/** The next free search_id, for a card insert. */
export const nextSearchId = sql<number>`(SELECT coalesce(max(${cards.search_id}), 0) + 1 FROM ${cards})`;

export function ftsDelete(db: Db, cardId: string) {
	return db.delete(cardsFts).where(eq(cardsFts.rowid, searchIdOf(cardId)));
}

/** Inserts the card's search row, or nothing if the card no longer exists. */
export function ftsInsert(db: Db, card: IndexedCard, subtaskTexts: string[]) {
	return db.insert(cardsFts).select(
		db
			.select({
				rowid: cards.search_id,
				card_id: cards.id,
				user_id: cards.user_id,
				title: sql<string>`${card.title}`.as('title'),
				notes: sql<string>`${card.notes ?? ''}`.as('notes'),
				subtasks: sql<string>`${subtaskTexts.join('\n')}`.as('subtasks')
			})
			.from(cards)
			.where(eq(cards.id, card.id))
	);
}
