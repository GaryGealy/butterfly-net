import { describe, expect, it } from 'vitest';
import { addDays, dueLabel, isIsoDate, isPlausibleToday, localDay, weekdayName } from './due';

describe('isIsoDate', () => {
	it('accepts real dates written YYYY-MM-DD', () => {
		for (const day of ['2026-11-20', '2028-02-29', '2026-12-31']) expect(isIsoDate(day)).toBe(true);
	});

	it('rejects impossible dates and other spellings', () => {
		for (const day of [
			'2026-02-29',
			'2026-13-01',
			'2026-11-31',
			'friday',
			'2026-1-5',
			'',
			' 2026-11-20'
		])
			expect(isIsoDate(day)).toBe(false);
	});
});

describe('addDays', () => {
	it('crosses month and year ends, forwards and back', () => {
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
		expect(addDays('2026-11-20', 0)).toBe('2026-11-20');
	});
});

describe('localDay', () => {
	const evening = new Date('2026-11-21T01:00:00Z');

	it("is the date in the user's time zone", () => {
		expect(localDay(evening, 'America/Chicago')).toBe('2026-11-20');
		expect(localDay(evening, 'UTC')).toBe('2026-11-21');
		expect(localDay(new Date('2026-11-20T12:00:00Z'), 'Pacific/Auckland')).toBe('2026-11-21');
	});

	it('falls back to UTC for a missing or unknown zone', () => {
		expect(localDay(evening)).toBe('2026-11-21');
		expect(localDay(evening, 'Mars/Olympus_Mons')).toBe('2026-11-21');
	});
});

describe('dueLabel', () => {
	const today = '2026-11-20'; // a Friday

	it('a day already past is Overdue, naming the day it was due', () => {
		expect(dueLabel('2026-11-18', today)).toEqual({
			text: 'Overdue',
			tone: 'overdue',
			title: 'Overdue: was due Wed, Nov 18',
			spoken: 'overdue, was due Wednesday, November 18'
		});
		expect(dueLabel('2025-12-31', today).title).toBe('Overdue: was due Wed, Dec 31, 2025');
	});

	it('today and tomorrow say so', () => {
		expect(dueLabel(today, today)).toEqual({
			text: 'Today',
			tone: 'today',
			title: 'Due today',
			spoken: 'due today'
		});
		expect(dueLabel('2026-11-21', today)).toEqual({
			text: 'Tomorrow',
			tone: 'plain',
			title: 'Due tomorrow',
			spoken: 'due tomorrow'
		});
	});

	it('two to six days out is the weekday', () => {
		expect(dueLabel('2026-11-23', today)).toEqual({
			text: 'Mon',
			tone: 'plain',
			title: 'Due Mon, Nov 23',
			spoken: 'due Monday, November 23'
		});
		expect(dueLabel('2026-11-26', today).text).toBe('Thu');
	});

	it('a week to a year out is the month and day, with the year only in the title', () => {
		expect(dueLabel('2026-11-27', today).text).toBe('Nov 27');
		expect(dueLabel('2027-01-04', today)).toEqual({
			text: 'Jan 4',
			tone: 'plain',
			title: 'Due Mon, Jan 4, 2027',
			spoken: 'due Monday, January 4, 2027'
		});
		expect(dueLabel('2027-11-20', today).text).toBe('Nov 20');
	});

	it('more than a year out shows the year', () => {
		expect(dueLabel('2027-11-21', today).text).toBe('Nov 21, 2027');
		expect(dueLabel('2028-01-04', today).title).toBe('Due Tue, Jan 4, 2028');
	});
});

describe('weekdayName', () => {
	it('names the day of the week', () => {
		expect(weekdayName('2026-11-20')).toBe('Friday');
		expect(weekdayName('2027-01-04')).toBe('Monday');
	});
});

describe('isPlausibleToday', () => {
	const now = new Date('2026-11-20T12:00:00Z');

	it("accepts the server's UTC date and the day either side, for any time zone", () => {
		for (const day of ['2026-11-19', '2026-11-20', '2026-11-21'])
			expect(isPlausibleToday(day, now)).toBe(true);
	});

	it('rejects a day two off, or something that is not a date', () => {
		for (const day of ['2026-11-18', '2026-11-22', '2026-02-30', 'today'])
			expect(isPlausibleToday(day, now)).toBe(false);
	});
});
