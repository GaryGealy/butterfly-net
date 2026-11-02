import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';

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

export const invites = sqliteTable('invites', {
	id: id(),
	code: text('code').notNull().unique(),
	created_by: text('created_by')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	created_at: createdAt(),
	expires_at: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
	used_at: integer('used_at', { mode: 'timestamp_ms' }),
	used_by: text('used_by').references(() => users.id, { onDelete: 'set null' })
});

/** One row per user per UTC day: how many Claude sorts they asked for. */
export const parseUsage = sqliteTable(
	'parse_usage',
	{
		user_id: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		day: text('day').notNull(),
		count: integer('count').notNull()
	},
	(t) => [primaryKey({ columns: [t.user_id, t.day] })]
);
