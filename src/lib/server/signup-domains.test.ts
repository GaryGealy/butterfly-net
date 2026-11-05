import { describe, expect, it } from 'vitest';
import { canSignUpWithoutInvite } from './signup-domains';

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
