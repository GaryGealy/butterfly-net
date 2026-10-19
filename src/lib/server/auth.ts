import { eq } from 'drizzle-orm';
import type { Db } from './db';
import { sessions, users } from './db/schema';
import { hashPassword, verifyPassword } from './password';
import { seedDefaultPiles } from './piles';

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionUser {
	id: string;
	email: string;
}

export class EmailTakenError extends Error {
	constructor() {
		super('An account with that email already exists');
		this.name = 'EmailTakenError';
	}
}

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export async function registerUser(db: Db, email: string, password: string): Promise<SessionUser> {
	const normalized = normalizeEmail(email);
	const [existing] = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, normalized))
		.limit(1);
	if (existing) throw new EmailTakenError();

	const [user] = await db
		.insert(users)
		.values({ email: normalized, password_hash: await hashPassword(password) })
		.returning({ id: users.id, email: users.email });
	await seedDefaultPiles(db, user.id);
	return user;
}

export async function authenticate(
	db: Db,
	email: string,
	password: string
): Promise<SessionUser | null> {
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.email, normalizeEmail(email)))
		.limit(1);
	if (!user) return null;
	return (await verifyPassword(password, user.password_hash))
		? { id: user.id, email: user.email }
		: null;
}

export async function createSession(db: Db, userId: string): Promise<string> {
	const [session] = await db
		.insert(sessions)
		.values({ user_id: userId, expires_at: new Date(Date.now() + SESSION_DURATION_MS) })
		.returning({ id: sessions.id });
	return session.id;
}

export async function validateSession(db: Db, sessionId: string): Promise<SessionUser | null> {
	const [row] = await db
		.select({ id: users.id, email: users.email, expires_at: sessions.expires_at })
		.from(sessions)
		.innerJoin(users, eq(sessions.user_id, users.id))
		.where(eq(sessions.id, sessionId))
		.limit(1);
	if (!row) return null;
	if (row.expires_at.getTime() <= Date.now()) {
		await deleteSession(db, sessionId);
		return null;
	}
	return { id: row.id, email: row.email };
}

export async function deleteSession(db: Db, sessionId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}
