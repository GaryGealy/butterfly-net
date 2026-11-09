import { describe, expect, it } from 'vitest';
import { httpUrl, sameStepText, sameUrl } from './links';

describe('httpUrl', () => {
	it('keeps an http(s) URL, trimmed', () => {
		expect(httpUrl('https://x.dev/a')).toBe('https://x.dev/a');
		expect(httpUrl(' http://x.dev/a ')).toBe('http://x.dev/a');
	});

	it('refuses other schemes, junk, overlong URLs and non-strings', () => {
		expect(httpUrl('javascript:alert(1)')).toBeNull();
		expect(httpUrl('ftp://x')).toBeNull();
		expect(httpUrl('not a url')).toBeNull();
		expect(httpUrl('https://x.dev/' + 'a'.repeat(2000))).toBeNull();
		expect(httpUrl(42)).toBeNull();
		expect(httpUrl('')).toBeNull();
	});
});

describe('sameUrl', () => {
	it('ignores www., a trailing slash, host case and the fragment', () => {
		expect(sameUrl('https://www.x.dev/a/', 'https://x.dev/a')).toBe(true);
		expect(sameUrl('https://X.dev/a#top', 'https://x.dev/a')).toBe(true);
	});

	it('tells different pages apart', () => {
		expect(sameUrl('https://x.dev/a', 'https://x.dev/b')).toBe(false);
		expect(sameUrl('https://x.dev/watch?v=1', 'https://x.dev/watch?v=2')).toBe(false);
		expect(sameUrl('not a url', 'not a url')).toBe(false);
	});
});

describe('sameStepText', () => {
	it('ignores case and spacing', () => {
		expect(sameStepText(' Read  the Paper ', 'read the paper')).toBe(true);
		expect(sameStepText('Read the paper', 'Read the book')).toBe(false);
	});
});
