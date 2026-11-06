import { env } from 'cloudflare:workers';
import { dev } from '$app/env';

/** A wrangler.toml [vars] value. The e2e dev server names its own through process.env. */
export function serverVar(name: 'ADMIN_EMAILS' | 'SIGNUP_DOMAINS'): string | undefined {
	return dev && process.env[name] !== undefined ? process.env[name] : env[name];
}
