import { json, redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { env } from 'cloudflare:workers';
import { validateSession } from './lib/server/auth';
import { getDb } from './lib/server/db';
import { isPublicPath } from './lib/server/routes';
import { SESSION_COOKIE_NAME } from './lib/server/session-cookie';

export const handle: Handle = async ({ event, resolve }) => {
	// Bindings come from cloudflare:workers; adapter-cloudflare 8 doesn't pass event.platform.
	event.locals.db = await getDb(env.DB);

	const sessionId = event.cookies.get(SESSION_COOKIE_NAME);
	event.locals.user = sessionId ? await validateSession(event.locals.db, sessionId) : null;

	// Gate everything by default, so a new route is protected without remembering to opt in.
	if (!event.locals.user && !isPublicPath(event.url.pathname)) {
		if (event.url.pathname.startsWith('/api/')) {
			return json({ error: 'Not signed in' }, { status: 401 });
		}
		redirect(303, `/login?next=${encodeURIComponent(event.url.pathname + event.url.search)}`);
	}

	return resolve(event);
};
