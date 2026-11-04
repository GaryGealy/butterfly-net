import { redirect } from '@sveltejs/kit';
import { findUsableInvite } from '../../lib/server/invites';
import type { PageServerLoad } from './$types';

/** The intro is only for someone holding a live invite; everyone else gets sign-up's own message. */
export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) redirect(303, '/');
	const code = url.searchParams.get('invite') ?? '';
	if (!code) redirect(303, '/signup');
	if (!(await findUsableInvite(locals.db, code))) {
		redirect(303, `/signup?invite=${encodeURIComponent(code)}`);
	}
	return { invite: code };
};
