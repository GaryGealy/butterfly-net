import { error } from '@sveltejs/kit';
import type { SessionUser } from './auth';

const PUBLIC_PATHS = new Set([
	'/login',
	'/signup',
	'/welcome',
	'/manifest.webmanifest',
	'/service-worker.js'
]);

export function isPublicPath(pathname: string): boolean {
	return PUBLIC_PATHS.has(pathname) || /^\/icons\/[\w.-]+$/.test(pathname);
}

/**
 * Only same-site absolute paths survive; anything else sends you home. Control characters and
 * backslashes are refused outright: browsers strip tabs/newlines and read a backslash as `/`, so
 * `/\t/evil.com` would otherwise become `//evil.com`.
 */
export function safeNext(next: string | null): string {
	// eslint-disable-next-line no-control-regex
	if (!next || !next.startsWith('/') || next.startsWith('//') || /[\u0000-\u001f\\]/.test(next))
		return '/';
	return next;
}

export function requireUser(locals: App.Locals): SessionUser {
	if (!locals.user) error(401, 'Not signed in');
	return locals.user;
}

/** Non-admins get a 404, so an admin page's existence isn't revealed. */
export function requireAdmin(locals: App.Locals): SessionUser {
	const user = requireUser(locals);
	if (!locals.isAdmin) error(404, 'Not found');
	return user;
}
