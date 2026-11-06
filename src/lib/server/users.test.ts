import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from './db';
import { users } from './db/schema';
import { claimInvite, createInvite, markInviteUsed } from './invites';
import { createTestDb, createTestUser } from './test/db';
import { listUsers } from './users';

let db: Db;
beforeEach(() => {
	db = createTestDb();
});

/** Makes a user signed up at the given time. */
async function userAt(email: string, iso: string): Promise<string> {
	const id = await createTestUser(db, email);
	await db
		.update(users)
		.set({ created_at: new Date(iso) })
		.where(eq(users.id, id));
	return id;
}

/** Makes a user who joined through an invite created by `inviterId`. */
async function invitedUser(email: string, iso: string, inviterId: string): Promise<string> {
	const invite = await createInvite(db, inviterId);
	await claimInvite(db, invite.code);
	const id = await userAt(email, iso);
	await markInviteUsed(db, invite.id, id);
	return id;
}

const config = { adminEmails: 'admin@test.dev', signupDomains: 'company.test' };

describe('listUsers', () => {
	it('lists everyone newest first with when they signed up', async () => {
		await userAt('admin@test.dev', '2026-10-01T00:00:00Z');
		await userAt('late@company.test', '2026-11-05T00:00:00Z');
		await userAt('middle@company.test', '2026-10-15T00:00:00Z');

		const list = await listUsers(db, config);
		expect(list.map((u) => u.email)).toEqual([
			'late@company.test',
			'middle@company.test',
			'admin@test.dev'
		]);
		expect(list[0].created_at).toEqual(new Date('2026-11-05T00:00:00Z'));
	});

	it('says who sent the invite a user joined with', async () => {
		const admin = await userAt('admin@test.dev', '2026-10-01T00:00:00Z');
		await invitedUser('friend@gmail.test', '2026-11-01T00:00:00Z', admin);

		const [friend] = await listUsers(db, config);
		expect(friend).toMatchObject({
			email: 'friend@gmail.test',
			joinedWith: 'invite',
			invitedBy: 'admin@test.dev'
		});
	});

	it('keeps a user whose inviter was deleted (the invite goes with the inviter)', async () => {
		const inviter = await userAt('gone@test.dev', '2026-10-01T00:00:00Z');
		await invitedUser('friend@gmail.test', '2026-11-01T00:00:00Z', inviter);
		await db.delete(users).where(eq(users.id, inviter));

		const list = await listUsers(db, config);
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ email: 'friend@gmail.test', joinedWith: 'none' });
	});

	it('marks a user with no invite at an open domain as a company email', async () => {
		await userAt('Colleague@Company.TEST', '2026-11-05T00:00:00Z');
		const [colleague] = await listUsers(db, config);
		expect(colleague).toMatchObject({ joinedWith: 'company', invitedBy: null });
	});

	it('marks a user with neither as no invite', async () => {
		await userAt('admin@test.dev', '2026-10-01T00:00:00Z');
		const [admin] = await listUsers(db, config);
		expect(admin).toMatchObject({ joinedWith: 'none', invitedBy: null });
	});

	it('an invite wins over an open domain', async () => {
		const admin = await userAt('admin@test.dev', '2026-10-01T00:00:00Z');
		await invitedUser('early@company.test', '2026-11-01T00:00:00Z', admin);
		const [early] = await listUsers(db, config);
		expect(early.joinedWith).toBe('invite');
	});

	it('flags admins from the admin list, ignoring case', async () => {
		await userAt('admin@test.dev', '2026-10-01T00:00:00Z');
		await userAt('someone@company.test', '2026-11-01T00:00:00Z');
		const list = await listUsers(db, { ...config, adminEmails: 'ADMIN@test.dev' });
		expect(list.map((u) => [u.email, u.isAdmin])).toEqual([
			['someone@company.test', false],
			['admin@test.dev', true]
		]);
	});

	it('never returns password hashes', async () => {
		await userAt('admin@test.dev', '2026-10-01T00:00:00Z');
		const [admin] = await listUsers(db, config);
		expect(Object.keys(admin).sort()).toEqual(
			['created_at', 'email', 'id', 'invitedBy', 'isAdmin', 'joinedWith'].sort()
		);
	});
});
