import { fail, redirect } from '@sveltejs/kit';
import { MAX_EMAIL_LENGTH } from '../../lib/limits';
import { authenticate, createSession } from '../../lib/server/auth';
import { safeNext } from '../../lib/server/routes';
import { setSessionCookie } from '../../lib/server/session-cookie';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
};

export const actions: Actions = {
	default: async ({ request, locals, cookies, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		if (email.length > MAX_EMAIL_LENGTH) {
			return fail(400, {
				email: '',
				error: `Email must be ${MAX_EMAIL_LENGTH} characters or fewer`
			});
		}
		const user = await authenticate(locals.db, email, String(form.get('password') ?? ''));
		if (!user) return fail(400, { email, error: 'Wrong email or password' });

		setSessionCookie(cookies, await createSession(locals.db, user.id));
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
