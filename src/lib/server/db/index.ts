import type { D1Database } from '@cloudflare/workers-types';
import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { dev } from '$app/env';
import * as schema from './schema';
import { withBatch } from './sqlite-batch';

// Shaped as the async D1 database. Local (better-sqlite3) and test instances are given this
// shape by withBatch: drizzle's better-sqlite3 query builders are awaitable, and withBatch adds
// D1's batch, so code written against the async D1 shape runs unchanged locally and in tests.
export type Db = DrizzleD1Database<typeof schema>;

let localDb: Db | null = null;

/**
 * The D1 binding in production; a local SQLite file (DATABASE_URL, default local.db) in dev.
 * Outside dev a missing binding is a deploy mistake, so it fails loudly rather than reaching
 * for SQLite (which can't run on Workers).
 */
export async function getDb(d1?: D1Database): Promise<Db> {
	if (!dev) {
		if (!d1) {
			throw new Error(
				'No D1 binding named DB: add a [[d1_databases]] block with binding = "DB" to wrangler.toml'
			);
		}
		return drizzleD1(d1, { schema });
	}

	if (!localDb) {
		const { drizzle } = await import('drizzle-orm/better-sqlite3');
		const Database = (await import('better-sqlite3')).default;
		const path = await import('node:path');
		const sqlite = new Database(path.join(process.cwd(), process.env.DATABASE_URL || 'local.db'));
		sqlite.pragma('foreign_keys = ON');
		// e2e helpers write to the same file from another process; wait rather than fail.
		sqlite.pragma('busy_timeout = 5000');
		localDb = withBatch(sqlite, drizzle(sqlite, { schema }));
	}
	return localDb;
}
