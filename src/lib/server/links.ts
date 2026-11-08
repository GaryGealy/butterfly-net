/** Longest link we store; real article and video URLs are far shorter. */
export const MAX_URL_LENGTH = 2000;

/** The URL, trimmed, when it is a well-formed http(s) URL of sensible length; otherwise null. */
export function httpUrl(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const value = raw.trim();
	if (!value || value.length > MAX_URL_LENGTH) return null;
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:' ? value : null;
	} catch {
		return null;
	}
}

function comparable(raw: string): string | null {
	const value = httpUrl(raw);
	if (!value) return null;
	const url = new URL(value);
	const host = url.hostname.toLowerCase().replace(/^www\./, '');
	const path = url.pathname.replace(/\/+$/, '');
	return `${host}${path}${url.search}`;
}

/** Whether two URLs name the same page, ignoring www., a trailing slash, host case and fragment. */
export function sameUrl(a: string, b: string): boolean {
	const left = comparable(a);
	return left !== null && left === comparable(b);
}

/** Whether two step texts say the same thing, ignoring case and spacing. */
export function sameStepText(a: string, b: string): boolean {
	const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
	return norm(a) === norm(b);
}
