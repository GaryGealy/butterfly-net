import { describe, expect, it } from 'vitest';
import { DUMMY_HASH, hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
	it('verifies the right password and rejects a wrong one', async () => {
		const hash = await hashPassword('correct horse battery');
		expect(hash.startsWith('pbkdf2v1:100000:')).toBe(true);
		expect(await verifyPassword('correct horse battery', hash)).toBe(true);
		expect(await verifyPassword('wrong', hash)).toBe(false);
	});

	it('salts each hash', async () => {
		expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
	});

	it('rejects a malformed stored hash', async () => {
		expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
	});

	it('DUMMY_HASH is a well-formed 100k hash that no password matches', async () => {
		expect(DUMMY_HASH).toMatch(/^pbkdf2v1:100000:[0-9a-f]{32}:[0-9a-f]{64}$/);
		expect(await verifyPassword('', DUMMY_HASH)).toBe(false);
		expect(await verifyPassword('correct horse battery', DUMMY_HASH)).toBe(false);
	});
});
