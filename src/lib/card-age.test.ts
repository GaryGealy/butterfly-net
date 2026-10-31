import { describe, expect, it } from 'vitest';
import { cardAge } from './card-age';

const NOW = new Date('2026-10-30T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe('cardAge stages', () => {
	it.each([
		[0, 'fresh'],
		[7 * DAY - 1, 'fresh'],
		[7 * DAY, 'cream'],
		[28 * DAY - 1, 'cream'],
		[28 * DAY, 'yellow'],
		[90 * DAY - 1, 'yellow'],
		[90 * DAY, 'deep'],
		[400 * DAY, 'deep']
	] as const)('%i ms old is %s', (age, stage) => {
		expect(cardAge(ago(age), NOW).stage).toBe(stage);
	});

	it('treats a card from the future (clock skew) as fresh', () => {
		expect(cardAge(new Date(NOW.getTime() + HOUR), NOW)).toEqual({
			stage: 'fresh',
			label: null,
			phrase: 'today'
		});
	});
});

describe('cardAge label', () => {
	it.each([
		[27 * DAY, null],
		[28 * DAY, '4w'],
		[5 * 7 * DAY + 3 * DAY, '5w'],
		[89 * DAY, '12w'],
		[90 * DAY, '3mo'],
		[200 * DAY, '6mo'],
		[364 * DAY, '12mo'],
		[365 * DAY, '1y'],
		[800 * DAY, '2y']
	] as const)('%i ms old is labelled %s', (age, label) => {
		expect(cardAge(ago(age), NOW).label).toBe(label);
	});
});

describe('cardAge phrase', () => {
	it.each([
		[0, 'today'],
		[DAY - 1, 'today'],
		[DAY, 'yesterday'],
		[2 * DAY, '2 days ago'],
		[6 * DAY, '6 days ago'],
		[7 * DAY, '1 week ago'],
		[5 * 7 * DAY, '5 weeks ago'],
		[90 * DAY, '3 months ago'],
		[365 * DAY, '1 year ago'],
		[800 * DAY, '2 years ago']
	] as const)('%i ms old reads "%s"', (age, phrase) => {
		expect(cardAge(ago(age), NOW).phrase).toBe(phrase);
	});
});
