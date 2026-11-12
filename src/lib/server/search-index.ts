import { asc, eq, sql } from 'drizzle-orm';
import type { Db } from './db';
import { runSql } from './db/raw';
import { cardsFts } from './db/fts';
import { cards, subtasks } from './db/schema';

/** Rewrites a card's row in cards_fts from its current title, notes and subtasks. */
export async function reindexCard(db: Db, cardId: string): Promise<void> {
	await removeFromIndex(db, cardId);
	const [card] = await db
		.select({ id: cards.id, user_id: cards.user_id, title: cards.title, notes: cards.notes })
		.from(cards)
		.where(eq(cards.id, cardId))
		.limit(1);
	if (!card) return;

	const items = await db
		.select({ text: subtasks.text })
		.from(subtasks)
		.where(eq(subtasks.card_id, cardId))
		.orderBy(asc(subtasks.sort_order));
	await runSql(
		db,
		sql`INSERT INTO cards_fts (card_id, user_id, title, notes, subtasks)
			VALUES (${card.id}, ${card.user_id}, ${card.title}, ${card.notes ?? ''}, ${items.map((s) => s.text).join('\n')})`
	);
}

export interface IndexedCard {
	id: string;
	userId: string;
	title: string;
	notes: string | null;
}

export function ftsDelete(db: Db, cardId: string) {
	return db.delete(cardsFts).where(eq(cardsFts.card_id, cardId));
}

export function ftsInsert(db: Db, card: IndexedCard, subtaskTexts: string[]) {
	return db.insert(cardsFts).values({
		card_id: card.id,
		user_id: card.userId,
		title: card.title,
		notes: card.notes ?? '',
		subtasks: subtaskTexts.join('\n')
	});
}

export async function removeFromIndex(db: Db, cardId: string): Promise<void> {
	await runSql(db, sql`DELETE FROM cards_fts WHERE card_id = ${cardId}`);
}
