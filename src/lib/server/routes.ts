import { error } from '@sveltejs/kit';
import type { SessionUser } from './auth';

const PUBLIC_PATHS = new Set(['/login', '/signup', '/manifest.webmanifest', '/service-worker.js']);

export function isPublicPath(pathname: string): boolean {
	return PUBLIC_PATHS.has(pathname) || /^\/icons\/[\w.-]+$/.test(pathname);
}

/** Only same-site absolute paths survive; anything else sends you home. */
export function safeNext(next: string | null): string {
	if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
	return next;
}

export function requireUser(locals: App.Locals): SessionUser {
	if (!locals.user) error(401, 'Not signed in');
	return locals.user;
}
