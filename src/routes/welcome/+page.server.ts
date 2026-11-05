import { redirect } from '@sveltejs/kit';
import { findUsableInvite } from '../../lib/server/invites';
import type { PageServerLoad } from './$types';

/**
 * The intro opens for anyone, so a shared link can show the demo first. A dead invite code skips
 * it and goes to sign-up's own message.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) redirect(303, '/');
	const code = url.searchParams.get('invite') ?? '';
	if (!code) return { invite: null };
	if (!(await findUsableInvite(locals.db, code))) {
		redirect(303, `/signup?invite=${encodeURIComponent(code)}`);
	}
	return { invite: code };
};
