import { desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { isAdminEmail } from './admin';
import type { Db } from './db';
import { invites, users } from './db/schema';
import { canSignUpWithoutInvite } from './signup-domains';

export interface ListedUser {
	id: string;
	email: string;
	created_at: Date;
	/**
	 * How they got in. `company` is worked out from today's SIGNUP_DOMAINS, since sign-up doesn't
	 * record it; `none` is anyone else, such as an admin made before invites existed.
	 */
	joinedWith: 'invite' | 'company' | 'none';
	/** The email of whoever made their invite, when they joined with one. */
	invitedBy: string | null;
	isAdmin: boolean;
}

const inviter = alias(users, 'inviter');

/** Everyone who has signed up, newest first. Never includes password hashes. */
export async function listUsers(
	db: Db,
	config: { adminEmails: string | undefined; signupDomains: string | undefined }
): Promise<ListedUser[]> {
	const rows = await db
		.select({
			id: users.id,
			email: users.email,
			created_at: users.created_at,
			inviteId: invites.id,
			invitedBy: inviter.email
		})
		.from(users)
		.leftJoin(invites, eq(invites.used_by, users.id))
		.leftJoin(inviter, eq(inviter.id, invites.created_by))
		.orderBy(desc(users.created_at));

	return rows.map(({ id, email, created_at, inviteId, invitedBy }) => ({
		id,
		email,
		created_at,
		joinedWith: inviteId
			? 'invite'
			: canSignUpWithoutInvite(email, config.signupDomains)
				? 'company'
				: 'none',
		invitedBy: invitedBy ?? null,
		isAdmin: isAdminEmail(email, config.adminEmails)
	}));
}
