import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Db } from '../db';
import * as schema from '../db/schema';
import { withBatch } from '../db/sqlite-batch';

/** A fresh in-memory database with every migration applied. */
export function createTestDb(): Db {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const local = drizzle(sqlite, { schema });
	migrate(local, { migrationsFolder: 'drizzle' });
	return withBatch(sqlite, local);
}

/**
 * Runs `fn` just before the db's `n`th batch (1-based), once: a stand-in for another request
 * changing the data between a function's read and its write.
 */
export function beforeBatch(db: Db, n: number, fn: () => Promise<unknown>): void {
	const batch = db.batch.bind(db);
	let calls = 0;
	db.batch = (async (queries: Parameters<Db['batch']>[0]) => {
		calls += 1;
		if (calls === n) await fn();
		return batch(queries);
	}) as unknown as Db['batch'];
}

/** Inserts a user directly (no password hashing) and returns its id. */
export async function createTestUser(
	db: Db,
	email = `user-${crypto.randomUUID()}@test.dev`
): Promise<string> {
	const [user] = await db
		.insert(schema.users)
		.values({ email, password_hash: 'unused' })
		.returning({ id: schema.users.id });
	return user.id;
}
