import type { SQL } from 'drizzle-orm';
import type { Db } from './index';

export async function runSql(db: Db, query: SQL): Promise<void> {
	await db.run(query);
}

export async function allSql<T>(db: Db, query: SQL): Promise<T[]> {
	return await db.all<T>(query);
}
