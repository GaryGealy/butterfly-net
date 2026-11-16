import { beforeEach, describe, expect, it } from 'vitest';
import { DAILY_OPEN_SIGNUP_LIMIT } from '../limits';
import type { Db } from './db';
import { users } from './db/schema';
import { canSignUpWithoutInvite, openSignupsPaused } from './signup-domains';
import { createTestDb } from './test/db';

describe('canSignUpWithoutInvite', () => {
	it('lets in an email at a listed domain', () => {
		expect(canSignUpWithoutInvite('ada@teamsparq.com', 'teamsparq.com')).toBe(true);
	});

	it('ignores case and spacing in both the email and the list', () => {
		expect(canSignUpWithoutInvite(' Ada@TeamSparq.COM ', ' TEAMSPARQ.com , other.org ')).toBe(true);
		expect(canSignUpWithoutInvite('bo@other.org', 'teamsparq.com, other.org')).toBe(true);
	});

	it('refuses look-alikes: subdomains, suffixes and the domain inside the name', () => {
		expect(canSignUpWithoutInvite('ada@mail.teamsparq.com', 'teamsparq.com')).toBe(false);
		expect(canSignUpWithoutInvite('ada@teamsparq.com.evil.io', 'teamsparq.com')).toBe(false);
		expect(canSignUpWithoutInvite('ada@notteamsparq.com', 'teamsparq.com')).toBe(false);
		expect(canSignUpWithoutInvite('teamsparq.com@evil.io', 'teamsparq.com')).toBe(false);
	});

	it('refuses everyone when the list is unset or blank', () => {
		expect(canSignUpWithoutInvite('ada@teamsparq.com', undefined)).toBe(false);
		expect(canSignUpWithoutInvite('ada@teamsparq.com', ' , ')).toBe(false);
	});
});

describe('openSignupsPaused', () => {
	const NOW = new Date('2026-11-16T12:00:00Z');
	const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);
	let db: Db;
	beforeEach(() => {
		db = createTestDb();
	});

	const addUsers = async (n: number, email: (i: number) => string, created = hoursAgo(1)) => {
		for (let i = 0; i < n; i++) {
			await db.insert(users).values({ email: email(i), password_hash: 'x', created_at: created });
		}
	};

	it('is false at one under the limit in the last day and true at the limit', async () => {
		await addUsers(DAILY_OPEN_SIGNUP_LIMIT - 1, (i) => `u${i}@teamsparq.com`);
		expect(await openSignupsPaused(db, 'teamsparq.com', NOW)).toBe(false);
		await addUsers(1, () => 'last@teamsparq.com');
		expect(await openSignupsPaused(db, 'teamsparq.com', NOW)).toBe(true);
	});

	it('ignores other domains and subdomains', async () => {
		await addUsers(DAILY_OPEN_SIGNUP_LIMIT, (i) => `u${i}@sub.teamsparq.com`);
		await addUsers(DAILY_OPEN_SIGNUP_LIMIT, (i) => `u${i}@gmail.com`);
		await addUsers(DAILY_OPEN_SIGNUP_LIMIT, (i) => `u${i}@notteamsparq.com`);
		expect(await openSignupsPaused(db, 'teamsparq.com', NOW)).toBe(false);
	});

	it('ignores open-domain users created more than 24 hours ago', async () => {
		await addUsers(DAILY_OPEN_SIGNUP_LIMIT, (i) => `old${i}@teamsparq.com`, hoursAgo(25));
		expect(await openSignupsPaused(db, 'teamsparq.com', NOW)).toBe(false);
	});

	it('counts every listed domain together', async () => {
		await addUsers(DAILY_OPEN_SIGNUP_LIMIT / 2, (i) => `a${i}@a.test`);
		await addUsers(DAILY_OPEN_SIGNUP_LIMIT / 2, (i) => `b${i}@b.test`);
		expect(await openSignupsPaused(db, 'a.test, b.test', NOW)).toBe(true);
		expect(await openSignupsPaused(db, 'a.test', NOW)).toBe(false);
	});

	it('is false when SIGNUP_DOMAINS is empty or unset', async () => {
		await addUsers(DAILY_OPEN_SIGNUP_LIMIT, (i) => `u${i}@teamsparq.com`);
		expect(await openSignupsPaused(db, undefined, NOW)).toBe(false);
		expect(await openSignupsPaused(db, ' , ', NOW)).toBe(false);
	});
});
