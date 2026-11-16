import { afterEach, describe, expect, it, vi } from 'vitest';
import { allowed, clientIp, limitsApply } from './rate-limit';

const request = (headers: Record<string, string> = {}) =>
	new Request('http://localhost/login', { method: 'POST', headers });

const stubLimiter = (success: boolean) => {
	const limit = vi.fn(async () => ({ success }));
	return { limiter: { limit } as RateLimit, limit };
};

afterEach(() => vi.restoreAllMocks());

describe('limitsApply', () => {
	it('always applies outside dev, with or without the header', () => {
		expect(limitsApply(request(), false)).toBe(true);
		expect(limitsApply(request({ 'x-e2e-rate-limit': 'on' }), false)).toBe(true);
	});

	it('in dev, applies only with x-e2e-rate-limit: on', () => {
		expect(limitsApply(request(), true)).toBe(false);
		expect(limitsApply(request({ 'x-e2e-rate-limit': 'off' }), true)).toBe(false);
		expect(limitsApply(request({ 'x-e2e-rate-limit': 'on' }), true)).toBe(true);
	});
});

describe('allowed', () => {
	it('returns the limiter outcome for the key it was given', async () => {
		const pass = stubLimiter(true);
		expect(await allowed(pass.limiter, 'login:1.2.3.4')).toBe(true);
		expect(pass.limit).toHaveBeenCalledWith({ key: 'login:1.2.3.4' });

		const block = stubLimiter(false);
		expect(await allowed(block.limiter, 'login:1.2.3.4')).toBe(false);
	});

	it('lets the request through and logs when the binding is missing', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await allowed(undefined, 'login:1.2.3.4')).toBe(true);
		expect(log).toHaveBeenCalledWith(expect.stringContaining('[rate-limit]'));
	});

	it('lets the request through and logs when limit() throws', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const limiter = {
			limit: async () => {
				throw new Error('limiter down');
			}
		} as RateLimit;
		expect(await allowed(limiter, 'login:1.2.3.4')).toBe(true);
		expect(log).toHaveBeenCalledWith(expect.stringContaining('[rate-limit]'), expect.any(Error));
	});
});

describe('clientIp', () => {
	it('returns the client address', () => {
		expect(clientIp({ getClientAddress: () => '203.0.113.7' })).toBe('203.0.113.7');
	});

	it("falls back to 'unknown' when getClientAddress throws or is empty", () => {
		expect(
			clientIp({
				getClientAddress: () => {
					throw new Error('no address');
				}
			})
		).toBe('unknown');
		expect(clientIp({ getClientAddress: () => '' })).toBe('unknown');
	});
});
