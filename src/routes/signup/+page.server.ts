import { error, fail, redirect } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { EmailTakenError, createSession, registerUser } from '../../lib/server/auth';
import {
	claimInvite,
	findUsableInvite,
	markInviteUsed,
	releaseInvite
} from '../../lib/server/invites';
import {
	allowed,
	clientIp,
	limitsApply,
	RETRY_AFTER_SECONDS,
	TOO_MANY
} from '../../lib/server/rate-limit';
import { setSessionCookie } from '../../lib/server/session-cookie';
import { canSignUpWithoutInvite } from '../../lib/server/signup-domains';
import { serverVar } from '../../lib/server/vars';
import { credentialsSchema } from '../../lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

const INVITE_ONLY_REFUSAL =
	'Sign-up is invite-only. Ask the person who told you about Butterfly Net for an invite link.';

export const load: PageServerLoad = async (event) => {
	const { locals, url, request } = event;
	if (locals.user) redirect(303, '/');
	const code = url.searchParams.get('invite') ?? '';
	if (
		code &&
		limitsApply(request) &&
		!(await allowed(env.AUTH_LIMITER, `invite:${clientIp(event)}`))
	) {
		error(429, TOO_MANY);
	}
	const invite = code ? await findUsableInvite(locals.db, code) : null;
	return { invite: invite ? code : null };
};

export const actions: Actions = {
	default: async (event) => {
		const { request, locals, cookies, setHeaders } = event;
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const parsed = credentialsSchema.safeParse({ email, password: form.get('password') });
		if (!parsed.success) return fail(400, { email, error: parsed.error.issues[0].message });
		if (limitsApply(request) && !(await allowed(env.AUTH_LIMITER, `signup:${clientIp(event)}`))) {
			setHeaders({ 'retry-after': String(RETRY_AFTER_SECONDS) });
			return fail(429, { email, error: TOO_MANY });
		}

		// An open-domain email needs no invite, so it never spends one it happens to carry.
		const openDomain = canSignUpWithoutInvite(parsed.data.email, serverVar('SIGNUP_DOMAINS'));
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
