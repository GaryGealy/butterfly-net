import type { SQL } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { Db } from './index';
import type * as schema from './schema';

// Drizzle's D1 and better-sqlite3 databases both have run() and all(), but one is
// async and one is sync, so TypeScript can't call them through the Db union. Both
// results are awaitable, which is all these helpers rely on.
type AnyDb = BetterSQLite3Database<typeof schema>;

export async function runSql(db: Db, query: SQL): Promise<void> {
	await (db as AnyDb).run(query);
}

export async function allSql<T>(db: Db, query: SQL): Promise<T[]> {
	return await (db as AnyDb).all<T>(query);
}
