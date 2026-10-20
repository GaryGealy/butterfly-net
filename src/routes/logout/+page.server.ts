import { redirect } from '@sveltejs/kit';
import { deleteSession } from '../../lib/server/auth';
import { SESSION_COOKIE_NAME, clearSessionCookie } from '../../lib/server/session-cookie';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	default: async ({ locals, cookies }) => {
		const sessionId = cookies.get(SESSION_COOKIE_NAME);
		if (sessionId) await deleteSession(locals.db, sessionId);
		clearSessionCookie(cookies);
		redirect(303, '/login');
	}
};
