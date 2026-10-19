import type { D1Database } from '@cloudflare/workers-types';
import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { dev } from '$app/env';
import * as schema from './schema';

// Shaped as the async D1 database. Local (better-sqlite3) and test instances are cast to it
// at creation: drizzle's better-sqlite3 query builders are awaitable, so code written against
// the async D1 shape runs unchanged locally and in tests.
export type Db = DrizzleD1Database<typeof schema>;

let localDb: Db | null = null;

/**
 * D1 when running on Cloudflare; a local SQLite file (DATABASE_URL, default local.db) in dev.
 */
export async function getDb(d1?: D1Database): Promise<Db> {
	if (!dev && d1) return drizzleD1(d1, { schema });

	if (!localDb) {
		const { drizzle } = await import('drizzle-orm/better-sqlite3');
		const Database = (await import('better-sqlite3')).default;
		const path = await import('node:path');
		const sqlite = new Database(path.join(process.cwd(), process.env.DATABASE_URL || 'local.db'));
		sqlite.pragma('foreign_keys = ON');
		localDb = drizzle(sqlite, { schema }) as unknown as Db;
	}
	return localDb;
}
