import { error, redirect } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { findUsableInvite } from '../../lib/server/invites';
import { allowed, clientIp, limitsApply, TOO_MANY } from '../../lib/server/rate-limit';
import type { PageServerLoad } from './$types';

/**
 * The intro opens for anyone, so a shared link can show the demo first. A dead invite code skips
 * it and goes to sign-up's own message.
 */
export const load: PageServerLoad = async (event) => {
	const { locals, url, request } = event;
	if (locals.user) redirect(303, '/');
	const code = url.searchParams.get('invite') ?? '';
	if (!code) return { invite: null };
	if (limitsApply(request) && !(await allowed(env.AUTH_LIMITER, `invite:${clientIp(event)}`))) {
		error(429, TOO_MANY);
	}
	if (!(await findUsableInvite(locals.db, code))) {
		redirect(303, `/signup?invite=${encodeURIComponent(code)}`);
	}
	return { invite: code };
};
