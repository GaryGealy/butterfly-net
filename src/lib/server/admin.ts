/** `ADMIN_EMAILS` is a comma-separated list; spacing and case don't matter. */
export function parseAdminEmails(raw: string | undefined): Set<string> {
	return new Set(
		(raw ?? '')
			.split(',')
			.map((email) => email.trim().toLowerCase())
			.filter(Boolean)
	);
}

export function isAdminEmail(email: string, raw: string | undefined): boolean {
	return parseAdminEmails(raw).has(email.trim().toLowerCase());
}
