import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from './db';
import {
	INVITE_LIFETIME_MS,
	claimInvite,
	createInvite,
	findUsableInvite,
	listInvites,
	markInviteUsed,
	releaseInvite,
	revokeInvite
} from './invites';
import { createTestDb, createTestUser } from './test/db';

const NOW = new Date('2026-11-02T12:00:00Z');
const later = (ms: number) => new Date(NOW.getTime() + ms);

let db: Db;
let adminId: string;
beforeEach(async () => {
	db = createTestDb();
	adminId = await createTestUser(db, 'admin@test.dev');
});

describe('createInvite', () => {
	it('makes a 22-character url-safe code that expires in 14 days', async () => {
		const invite = await createInvite(db, adminId, NOW);
		expect(invite.code).toMatch(/^[A-Za-z0-9_-]{22}$/);
		expect(invite.expires_at.getTime()).toBe(NOW.getTime() + INVITE_LIFETIME_MS);
		expect(INVITE_LIFETIME_MS).toBe(14 * 24 * 60 * 60 * 1000);
	});

	it('makes a different code each time', async () => {
		const a = await createInvite(db, adminId, NOW);
		const b = await createInvite(db, adminId, NOW);
		expect(a.code).not.toBe(b.code);
	});
});

describe('findUsableInvite', () => {
	it('finds an unused, unexpired code', async () => {
		const { id, code } = await createInvite(db, adminId, NOW);
		expect(await findUsableInvite(db, code, later(1000))).toEqual({ id });
	});

	it('rejects unknown, expired and used codes', async () => {
		const { code } = await createInvite(db, adminId, NOW);
		expect(await findUsableInvite(db, 'no-such-code', NOW)).toBeNull();
		expect(await findUsableInvite(db, code, later(INVITE_LIFETIME_MS))).toBeNull();
		await claimInvite(db, code, NOW);
		expect(await findUsableInvite(db, code, NOW)).toBeNull();
	});
});

describe('claimInvite', () => {
	it('succeeds once, then fails', async () => {
		const { id, code } = await createInvite(db, adminId, NOW);
		expect(await claimInvite(db, code, NOW)).toEqual({ id });
		expect(await claimInvite(db, code, NOW)).toBeNull();
	});

	it('fails for an expired code', async () => {
		const { code } = await createInvite(db, adminId, NOW);
		expect(await claimInvite(db, code, later(INVITE_LIFETIME_MS))).toBeNull();
	});

	it('can be claimed again after it is released', async () => {
		const { id, code } = await createInvite(db, adminId, NOW);
		await claimInvite(db, code, NOW);
		await releaseInvite(db, id);
		expect(await claimInvite(db, code, NOW)).toEqual({ id });
	});
});

describe('revokeInvite', () => {
	it('deletes an unused invite', async () => {
		const { id, code } = await createInvite(db, adminId, NOW);
		expect(await revokeInvite(db, id)).toBe(true);
		expect(await findUsableInvite(db, code, NOW)).toBeNull();
	});

	it('leaves a used invite and its history alone', async () => {
		const { id, code } = await createInvite(db, adminId, NOW);
		const joinerId = await createTestUser(db, 'joiner@test.dev');
		await claimInvite(db, code, NOW);
		await markInviteUsed(db, id, joinerId);
		expect(await revokeInvite(db, id)).toBe(false);
		expect((await listInvites(db, NOW)).used).toHaveLength(1);
	});
});

describe('listInvites', () => {
	it('lists unused and used invites, newest first, and hides expired unused ones', async () => {
		const old = await createInvite(db, adminId, new Date(NOW.getTime() - INVITE_LIFETIME_MS));
		const first = await createInvite(db, adminId, NOW);
		const second = await createInvite(db, adminId, later(1000));
		const used = await createInvite(db, adminId, NOW);
		const joinerId = await createTestUser(db, 'joiner@test.dev');
		await claimInvite(db, used.code, later(2000));
		await markInviteUsed(db, used.id, joinerId);

		const { unused, used: usedList } = await listInvites(db, later(3000));
		expect(unused.map((i) => i.id)).toEqual([second.id, first.id]);
		expect(unused.map((i) => i.id)).not.toContain(old.id);
		expect(usedList).toEqual([{ id: used.id, used_at: later(2000), email: 'joiner@test.dev' }]);
	});
});
