import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from './db';
import { allSql } from './db/raw';
import { cards, piles } from './db/schema';

const MAX_RESULTS = 50;

export interface SearchResult {
	id: string;
	title: string;
	notes: string | null;
	status: 'active' | 'done';
	pile_name: string;
}

/**
 * Builds an FTS5 query from free text. Only runs of letters and digits survive, each
 * quoted as a literal prefix term, so nothing typed can be read as FTS5 syntax.
 */
export function toFtsQuery(input: string): string | null {
	const terms = input.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
	if (terms.length === 0) return null;
	return terms.map((term) => `"${term}"*`).join(' ');
}

export async function searchCards(db: Db, userId: string, input: string): Promise<SearchResult[]> {
	const query = toFtsQuery(input);
	if (!query) return [];

	const hits = await allSql<{ card_id: string }>(
		db,
		sql`SELECT card_id FROM cards_fts
			WHERE cards_fts MATCH ${query} AND user_id = ${userId}
			ORDER BY rank LIMIT ${MAX_RESULTS}`
	);
	if (hits.length === 0) return [];

	const ids = hits.map((hit) => hit.card_id);
	const rows = await db
		.select({
			id: cards.id,
			title: cards.title,
			notes: cards.notes,
			status: cards.status,
			pile_name: piles.name
		})
		.from(cards)
		.innerJoin(piles, eq(cards.pile_id, piles.id))
		.where(and(eq(cards.user_id, userId), inArray(cards.id, ids)));

	// Keep FTS rank order.
	const byId = new Map(rows.map((row) => [row.id, row]));
	return ids.flatMap((id) => byId.get(id) ?? []);
}
