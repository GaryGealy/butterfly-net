import { dev } from '$app/env';

export const TOO_MANY = 'Too many tries. Wait a minute and try again.';
export const RETRY_AFTER_SECONDS = 60;

/** Outside dev, always. In dev, only for requests that opt in, so the e2e suite isn't limited. */
export function limitsApply(request: Request, isDev = dev): boolean {
	return !isDev || request.headers.get('x-e2e-rate-limit') === 'on';
}

/** The client's IP, or 'unknown' when the runtime can't say. */
export function clientIp(event: { getClientAddress(): string }): string {
	try {
		return event.getClientAddress() || 'unknown';
	} catch {
		return 'unknown';
	}
}

/** True if the request may go ahead. A missing binding or a limiter error lets it through. */
export async function allowed(limiter: RateLimit | undefined, key: string): Promise<boolean> {
	if (!limiter) {
		console.error('[rate-limit] no limiter binding');
		return true;
	}
	try {
		return (await limiter.limit({ key })).success;
	} catch (e) {
		console.error('[rate-limit] limiter failed', e);
		return true;
	}
}
