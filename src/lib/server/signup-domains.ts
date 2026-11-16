import { and, count, gt, like, or } from 'drizzle-orm';
import { DAILY_OPEN_SIGNUP_LIMIT } from '../limits';
import type { Db } from './db';
import { users } from './db/schema';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `SIGNUP_DOMAINS` is a comma-separated list of email domains whose people can sign up without an
 * invite; spacing and case don't matter. Only the exact domain counts, not its subdomains. The
 * address isn't verified, so this trusts whoever types it.
 */
export function signupDomains(raw: string | undefined): string[] {
	return (raw ?? '')
		.split(',')
		.map((domain) => domain.trim().toLowerCase())
		.filter(Boolean);
}

export function canSignUpWithoutInvite(email: string, raw: string | undefined): boolean {
	const address = email.trim().toLowerCase();
	const at = address.lastIndexOf('@');
	return at > 0 && signupDomains(raw).includes(address.slice(at + 1));
}

/** True once the last 24 hours hold DAILY_OPEN_SIGNUP_LIMIT accounts at a `SIGNUP_DOMAINS` domain. */
export async function openSignupsPaused(
	db: Db,
	raw: string | undefined,
	now = new Date()
): Promise<boolean> {
	const domains = signupDomains(raw);
	if (domains.length === 0) return false;
	const [{ n }] = await db
		.select({ n: count() })
		.from(users)
		.where(
			and(
				gt(users.created_at, new Date(now.getTime() - DAY_MS)),
				or(...domains.map((domain) => like(users.email, `%@${domain}`)))
			)
		);
	return n >= DAILY_OPEN_SIGNUP_LIMIT;
}
