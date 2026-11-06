import { requireAdmin } from '../../lib/server/routes';
import { listUsers } from '../../lib/server/users';
import { serverVar } from '../../lib/server/vars';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	return {
		users: await listUsers(locals.db, {
			adminEmails: serverVar('ADMIN_EMAILS'),
			signupDomains: serverVar('SIGNUP_DOMAINS')
		})
	};
};
