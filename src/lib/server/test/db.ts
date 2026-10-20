import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Db } from '../db';
import * as schema from '../db/schema';

/** A fresh in-memory database with every migration applied. */
export function createTestDb(): Db {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const local = drizzle(sqlite, { schema });
	migrate(local, { migrationsFolder: 'drizzle' });
	// Cast to the shared Db shape; see the note in db/index.ts.
	return local as unknown as Db;
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
