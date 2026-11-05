/**
 * `SIGNUP_DOMAINS` is a comma-separated list of email domains whose people can sign up without an
 * invite; spacing and case don't matter. Only the exact domain counts, not its subdomains. The
 * address isn't verified, so this trusts whoever types it.
 */
export function canSignUpWithoutInvite(email: string, raw: string | undefined): boolean {
	const domains = new Set(
		(raw ?? '')
			.split(',')
			.map((domain) => domain.trim().toLowerCase())
			.filter(Boolean)
	);
	const address = email.trim().toLowerCase();
	const at = address.lastIndexOf('@');
	return at > 0 && domains.has(address.slice(at + 1));
}
