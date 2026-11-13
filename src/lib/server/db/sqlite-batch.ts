import type Database from 'better-sqlite3';
import { is } from 'drizzle-orm';
import { SQLiteSelectBase } from 'drizzle-orm/sqlite-core';
import type { Db } from './index';

interface SyncQuery {
	config?: { returning?: unknown };
	all(): unknown;
	run(): unknown;
}

/**
 * Gives a better-sqlite3 drizzle instance D1's `batch`: every query runs synchronously in one
 * transaction, so a failure rolls the whole batch back. Raw `db.run(sql)` executes eagerly on
 * this driver, so only query builders may go in a batch.
 */
export function withBatch(sqlite: Database.Database, local: object): Db {
	const runAll = sqlite.transaction((queries: readonly SyncQuery[]) =>
		queries.map((query) =>
			is(query, SQLiteSelectBase) || query.config?.returning ? query.all() : query.run()
		)
	);
	Object.assign(local, {
		batch: async (queries: readonly SyncQuery[]) => runAll(queries)
	});
	return local as Db;
}
