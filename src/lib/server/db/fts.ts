import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// The FTS5 virtual table from drizzle/0001, declared outside schema.ts so drizzle-kit never
// generates it, and so search-index writes are query builders that can go in a batch.
export const cardsFts = sqliteTable('cards_fts', {
	rowid: integer('rowid'),
	card_id: text('card_id').notNull(),
	user_id: text('user_id').notNull(),
	title: text('title').notNull(),
	notes: text('notes').notNull(),
	subtasks: text('subtasks').notNull()
});
