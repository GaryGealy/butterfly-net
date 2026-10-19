import { describe, expect, it } from 'vitest';
import { isPublicPath, requireUser, safeNext } from './routes';

describe('isPublicPath', () => {
	it('allows only the auth pages and PWA assets without a session', () => {
		expect(isPublicPath('/login')).toBe(true);
		expect(isPublicPath('/signup')).toBe(true);
		expect(isPublicPath('/manifest.webmanifest')).toBe(true);
		expect(isPublicPath('/icons/icon-192.png')).toBe(true);
		expect(isPublicPath('/')).toBe(false);
		expect(isPublicPath('/api/parse')).toBe(false);
		expect(isPublicPath('/login/../card/1')).toBe(false);
	});
});

describe('safeNext', () => {
	it('keeps same-site paths and rejects everything else', () => {
		expect(safeNext('/card/abc?x=1')).toBe('/card/abc?x=1');
		expect(safeNext(null)).toBe('/');
		expect(safeNext('https://evil.example')).toBe('/');
		expect(safeNext('//evil.example')).toBe('/');
		expect(safeNext('/\\evil.example')).toBe('/');
	});
});

describe('requireUser', () => {
	it('returns the user or throws a 401', () => {
		const user = { id: 'u1', email: 'a@b.co' };
		expect(requireUser({ user } as App.Locals)).toBe(user);
		expect(() => requireUser({ user: null } as App.Locals)).toThrow();
		let thrown: unknown;
		try {
			requireUser({ user: null } as App.Locals);
		} catch (e) {
			thrown = e;
		}
		expect(thrown).toMatchObject({ status: 401 });
	});
});
