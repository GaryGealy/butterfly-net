import Database from 'better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Db } from '../db';
import * as schema from '../db/schema';

/** A fresh in-memory database with every migration applied. */
export function createTestDb(): Db {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: 'drizzle' });
	return db;
}

/** Inserts a user directly (no password hashing) and returns its id. */
export async function createTestUser(
	db: Db,
	email = `user-${crypto.randomUUID()}@test.dev`
): Promise<string> {
	// The Db union (D1 | better-sqlite3) can't be called with returning(columns); tests only use sqlite.
	const [user] = await (db as BetterSQLite3Database<typeof schema>)
		.insert(schema.users)
		.values({ email, password_hash: 'unused' })
		.returning({ id: schema.users.id });
	return user.id;
}
