import type { SQL } from 'drizzle-orm';
import type { Db } from './index';

export async function allSql<T>(db: Db, query: SQL): Promise<T[]> {
	return await db.all<T>(query);
}
