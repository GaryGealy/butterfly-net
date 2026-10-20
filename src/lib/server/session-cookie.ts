import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/env';
import { SESSION_DURATION_MS } from './auth';

export const SESSION_COOKIE_NAME = 'session';

export function setSessionCookie(cookies: Cookies, sessionId: string): void {
	cookies.set(SESSION_COOKIE_NAME, sessionId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: SESSION_DURATION_MS / 1000
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}
