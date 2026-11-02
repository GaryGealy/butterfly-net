import { and, desc, eq, gt, isNotNull, isNull } from 'drizzle-orm';
import type { Db } from './db';
import { invites, users } from './db/schema';

export const INVITE_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

export interface UnusedInvite {
	id: string;
	code: string;
	created_at: Date;
	expires_at: Date;
}

export interface UsedInvite {
	id: string;
	used_at: Date;
	/** Null when the account that used it has since been deleted. */
	email: string | null;
}

/** 16 random bytes as base64url: 22 characters, safe in a URL. */
function newCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

export async function createInvite(
	db: Db,
	adminId: string,
	now = new Date()
): Promise<{ id: string; code: string; expires_at: Date }> {
	const [invite] = await db
		.insert(invites)
		.values({
			code: newCode(),
			created_by: adminId,
			created_at: now,
			expires_at: new Date(now.getTime() + INVITE_LIFETIME_MS)
		})
		.returning({ id: invites.id, code: invites.code, expires_at: invites.expires_at });
	return invite;
}

const usable = (code: string, now: Date) =>
	and(eq(invites.code, code), isNull(invites.used_at), gt(invites.expires_at, now));

export async function findUsableInvite(
	db: Db,
	code: string,
	now = new Date()
): Promise<{ id: string } | null> {
	const [invite] = await db
		.select({ id: invites.id })
		.from(invites)
		.where(usable(code, now))
		.limit(1);
	return invite ?? null;
}

/** Marks the code used in one statement, so of two simultaneous sign-ups only one wins. */
export async function claimInvite(
	db: Db,
	code: string,
	now = new Date()
): Promise<{ id: string } | null> {
	const [invite] = await db
		.update(invites)
		.set({ used_at: now })
		.where(usable(code, now))
		.returning({ id: invites.id });
	return invite ?? null;
}

/** Undoes a claim when the account couldn't be created, so the link still works. */
export async function releaseInvite(db: Db, id: string): Promise<void> {
	await db.update(invites).set({ used_at: null }).where(eq(invites.id, id));
}

export async function markInviteUsed(db: Db, id: string, userId: string): Promise<void> {
	await db.update(invites).set({ used_by: userId }).where(eq(invites.id, id));
}

/** Deletes an unused invite. A used one is kept, along with who joined through it. */
export async function revokeInvite(db: Db, id: string): Promise<boolean> {
	const deleted = await db
		.delete(invites)
		.where(and(eq(invites.id, id), isNull(invites.used_at)))
		.returning({ id: invites.id });
	return deleted.length > 0;
}

export async function listInvites(
	db: Db,
	now = new Date()
): Promise<{ unused: UnusedInvite[]; used: UsedInvite[] }> {
	const unused = await db
		.select({
			id: invites.id,
			code: invites.code,
			created_at: invites.created_at,
			expires_at: invites.expires_at
		})
		.from(invites)
		.where(and(isNull(invites.used_at), gt(invites.expires_at, now)))
		.orderBy(desc(invites.created_at));
	const usedRows = await db
		.select({ id: invites.id, used_at: invites.used_at, email: users.email })
		.from(invites)
		.leftJoin(users, eq(invites.used_by, users.id))
		.where(isNotNull(invites.used_at))
		.orderBy(desc(invites.used_at));
	const used = usedRows.map((row) => ({ ...row, used_at: row.used_at as Date }));
	return { unused, used };
}
