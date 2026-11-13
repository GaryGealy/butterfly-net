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

export function ftsInsert(db: Db, card: IndexedCard, subtaskTexts: string[]) {
	return db.insert(cardsFts).values({
		rowid: searchIdOf(card.id),
		card_id: card.id,
		user_id: card.userId,
		title: card.title,
		notes: card.notes ?? '',
		subtasks: subtaskTexts.join('\n')
	});
}
