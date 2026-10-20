import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
	integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date());

export const users = sqliteTable('users', {
	id: id(),
	email: text('email').notNull().unique(),
	password_hash: text('password_hash').notNull(),
	created_at: createdAt()
});

export const sessions = sqliteTable('sessions', {
	id: id(),
	user_id: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expires_at: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
	created_at: createdAt()
});

export const piles = sqliteTable(
	'piles',
	{
		id: id(),
		user_id: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		sort_order: integer('sort_order').notNull(),
		created_at: createdAt()
	},
	(t) => [uniqueIndex('piles_user_name_idx').on(t.user_id, t.name)]
);

export const cards = sqliteTable(
	'cards',
	{
		id: id(),
		user_id: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		pile_id: text('pile_id')
			.notNull()
			.references(() => piles.id),
		title: text('title').notNull(),
		notes: text('notes'),
		status: text('status', { enum: ['active', 'done'] })
			.notNull()
			.default('active'),
		created_at: createdAt(),
		done_at: integer('done_at', { mode: 'timestamp_ms' })
	},
	(t) => [index('cards_user_status_idx').on(t.user_id, t.status)]
);

export const subtasks = sqliteTable('subtasks', {
	id: id(),
	card_id: text('card_id')
		.notNull()
		.references(() => cards.id, { onDelete: 'cascade' }),
	text: text('text').notNull(),
	done: integer('done', { mode: 'boolean' }).notNull().default(false),
	sort_order: integer('sort_order').notNull()
});
