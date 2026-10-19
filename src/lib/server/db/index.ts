import type { D1Database } from '@cloudflare/workers-types';
import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { dev } from '$app/env';
import * as schema from './schema';

export type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

let localDb: BetterSQLite3Database<typeof schema> | null = null;

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
		localDb = drizzle(sqlite, { schema });
	}
	return localDb;
}
