import { beforeEach, describe, expect, it } from 'vitest';
import {
	EmailTakenError,
	authenticate,
	createSession,
	deleteSession,
	registerUser,
	validateSession
} from './auth';
import type { Db } from './db';
import { sessions } from './db/schema';
import { listPiles } from './piles';
import { createTestDb } from './test/db';

let db: Db;
beforeEach(() => {
	db = createTestDb();
});

describe('registerUser', () => {
	it('normalizes the email and seeds the default piles', async () => {
		const user = await registerUser(db, '  Gary@Example.COM ', 'correct horse battery');
		expect(user.email).toBe('gary@example.com');
		expect((await listPiles(db, user.id)).map((p) => p.name)).toEqual([
			'house',
			'work stuff',
			'ideas',
			'video games',
			'model building'
		]);
	});

	it('rejects an email that is already registered, ignoring case', async () => {
		await registerUser(db, 'gary@example.com', 'correct horse battery');
		await expect(registerUser(db, 'GARY@example.com', 'another password')).rejects.toThrow(
			EmailTakenError
		);
	});
});

describe('authenticate', () => {
	it('returns the user for the right password only', async () => {
		const user = await registerUser(db, 'gary@example.com', 'correct horse battery');
		expect(await authenticate(db, 'Gary@example.com', 'correct horse battery')).toEqual(user);
		expect(await authenticate(db, 'gary@example.com', 'wrong password')).toBeNull();
		expect(await authenticate(db, 'nobody@example.com', 'correct horse battery')).toBeNull();
	});
});

describe('sessions', () => {
	it('validates a live session and forgets a deleted one', async () => {
		const user = await registerUser(db, 'gary@example.com', 'correct horse battery');
		const sessionId = await createSession(db, user.id);
		expect(await validateSession(db, sessionId)).toEqual(user);
		await deleteSession(db, sessionId);
		expect(await validateSession(db, sessionId)).toBeNull();
	});

	it('rejects and removes an expired session', async () => {
		const user = await registerUser(db, 'gary@example.com', 'correct horse battery');
		const [expired] = await db
			.insert(sessions)
			.values({ user_id: user.id, expires_at: new Date(Date.now() - 1000) })
			.returning({ id: sessions.id });
		expect(await validateSession(db, expired.id)).toBeNull();
		expect(await db.select().from(sessions)).toHaveLength(0);
	});
});
