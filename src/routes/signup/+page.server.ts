import { fail, redirect } from '@sveltejs/kit';
import { EmailTakenError, createSession, registerUser } from '../../lib/server/auth';
import { setSessionCookie } from '../../lib/server/session-cookie';
import { credentialsSchema } from '../../lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const parsed = credentialsSchema.safeParse({ email, password: form.get('password') });
		if (!parsed.success) return fail(400, { email, error: parsed.error.issues[0].message });

		try {
			const user = await registerUser(locals.db, parsed.data.email, parsed.data.password);
			setSessionCookie(cookies, await createSession(locals.db, user.id));
		} catch (e) {
			if (e instanceof EmailTakenError) return fail(400, { email, error: e.message });
			throw e;
		}
		redirect(303, '/');
	}
};
