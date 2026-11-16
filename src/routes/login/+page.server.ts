import { fail, redirect } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { MAX_EMAIL_LENGTH } from '../../lib/limits';
import { authenticate, createSession, normalizeEmail } from '../../lib/server/auth';
import {
	allowed,
	clientIp,
	limitsApply,
	RETRY_AFTER_SECONDS,
	TOO_MANY
} from '../../lib/server/rate-limit';
import { safeNext } from '../../lib/server/routes';
import { setSessionCookie } from '../../lib/server/session-cookie';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
};

export const actions: Actions = {
	default: async (event) => {
		const { request, locals, cookies, url, setHeaders } = event;
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		if (email.length > MAX_EMAIL_LENGTH) {
			return fail(400, {
				email: '',
				error: `Email must be ${MAX_EMAIL_LENGTH} characters or fewer`
			});
		}
		if (limitsApply(request)) {
			const ip = clientIp(event);
			const ok =
				(await allowed(env.AUTH_LIMITER, `login:${ip}`)) &&
				(await allowed(env.LOGIN_EMAIL_LIMITER, normalizeEmail(email)));
			if (!ok) {
				setHeaders({ 'retry-after': String(RETRY_AFTER_SECONDS) });
				return fail(429, { email, error: TOO_MANY });
			}
		}
		const user = await authenticate(locals.db, email, String(form.get('password') ?? ''));
		if (!user) return fail(400, { email, error: 'Wrong email or password' });

		setSessionCookie(cookies, await createSession(locals.db, user.id));
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
