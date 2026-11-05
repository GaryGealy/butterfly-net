import { fail, redirect } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { dev } from '$app/env';
import { EmailTakenError, createSession, registerUser } from '../../lib/server/auth';
import {
	claimInvite,
	findUsableInvite,
	markInviteUsed,
	releaseInvite
} from '../../lib/server/invites';
import { setSessionCookie } from '../../lib/server/session-cookie';
import { canSignUpWithoutInvite } from '../../lib/server/signup-domains';
import { credentialsSchema } from '../../lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

const INVITE_ONLY_REFUSAL =
	'Sign-up is invite-only. Ask the person who told you about Butterfly Net for an invite link.';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) redirect(303, '/');
	const code = url.searchParams.get('invite') ?? '';
	const invite = code ? await findUsableInvite(locals.db, code) : null;
	return { invite: invite ? code : null };
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const parsed = credentialsSchema.safeParse({ email, password: form.get('password') });
		if (!parsed.success) return fail(400, { email, error: parsed.error.issues[0].message });

		// The e2e server names its own open domains; everywhere else the wrangler.toml var decides.
		const signupDomains =
			dev && process.env.SIGNUP_DOMAINS !== undefined
				? process.env.SIGNUP_DOMAINS
				: env.SIGNUP_DOMAINS;
		// An open-domain email needs no invite, so it never spends one it happens to carry.
		const openDomain = canSignUpWithoutInvite(parsed.data.email, signupDomains);
		const invite = openDomain
			? null
			: await claimInvite(locals.db, String(form.get('invite') ?? ''));
		if (!openDomain && !invite) {
			return fail(400, { email, inviteRejected: true, error: INVITE_ONLY_REFUSAL });
		}

		let user;
		try {
			user = await registerUser(locals.db, parsed.data.email, parsed.data.password);
		} catch (e) {
			// No account was made, so give the link back: a taken email doesn't burn the invite.
			if (invite) await releaseInvite(locals.db, invite.id);
			if (e instanceof EmailTakenError) return fail(400, { email, error: e.message });
			throw e;
		}
		if (invite) await markInviteUsed(locals.db, invite.id, user.id);
		setSessionCookie(cookies, await createSession(locals.db, user.id));
		redirect(303, '/');
	}
};
