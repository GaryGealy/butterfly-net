import { sql } from 'drizzle-orm';
import type { Db } from './db';
import { parseUsage } from './db/schema';

/** The allowance resets at midnight UTC. */
export function usageDay(now: Date): string {
	return now.toISOString().slice(0, 10);
}

/** Counts one Claude sort for the user today and returns today's new total, in one statement. */
export async function countParse(db: Db, userId: string, now = new Date()): Promise<number> {
	const [row] = await db
		.insert(parseUsage)
		.values({ user_id: userId, day: usageDay(now), count: 1 })
		.onConflictDoUpdate({
			target: [parseUsage.user_id, parseUsage.day],
			set: { count: sql`${parseUsage.count} + 1` }
		})
		.returning({ count: parseUsage.count });
	return row.count;
}
