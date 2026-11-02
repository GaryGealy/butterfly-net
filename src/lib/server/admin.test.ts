import { describe, expect, it } from 'vitest';
import { isAdminEmail, parseAdminEmails } from './admin';

describe('parseAdminEmails', () => {
	it('lowercases, trims and drops empty entries', () => {
		expect(parseAdminEmails(' Gary.M.Gealy@Gmail.com , other@x.com ,, ')).toEqual(
			new Set(['gary.m.gealy@gmail.com', 'other@x.com'])
		);
	});

	it('is empty when unset or blank', () => {
		expect(parseAdminEmails(undefined).size).toBe(0);
		expect(parseAdminEmails('  ').size).toBe(0);
	});
});

describe('isAdminEmail', () => {
	it('matches the session email against the list, ignoring case', () => {
		expect(isAdminEmail('gary.m.gealy@gmail.com', 'Gary.M.Gealy@gmail.com')).toBe(true);
		expect(isAdminEmail('someone@else.com', 'gary.m.gealy@gmail.com')).toBe(false);
	});

	it('is false for everyone when the list is unset', () => {
		expect(isAdminEmail('gary.m.gealy@gmail.com', undefined)).toBe(false);
	});
});
