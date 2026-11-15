import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from './db';
import { createTestDb, createTestUser } from './test/db';
import { DAILY_PARSE_LIMIT } from '../limits';
import { countParse, parsesToday, refundParse, usageDay } from './usage';

let db: Db;
let userId: string;
beforeEach(async () => {
	db = createTestDb();
	userId = await createTestUser(db);
});

describe('usageDay', () => {
	it('is the UTC calendar day', () => {
		expect(usageDay(new Date('2026-11-02T23:59:59.999Z'))).toBe('2026-11-02');
		expect(usageDay(new Date('2026-11-03T00:00:00.000Z'))).toBe('2026-11-03');
	});
});

describe('countParse', () => {
	it('counts up from 1 within a day', async () => {
		const now = new Date('2026-11-02T10:00:00Z');
		const counts = [];
		for (let i = 0; i < 21; i++) counts.push(await countParse(db, userId, now));
		expect(counts).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
	});

	it('starts again at 1 at midnight UTC', async () => {
		await countParse(db, userId, new Date('2026-11-02T23:59:59Z'));
		await countParse(db, userId, new Date('2026-11-02T23:59:59Z'));
		expect(await countParse(db, userId, new Date('2026-11-03T00:00:00Z'))).toBe(1);
	});

	it('counts each user separately', async () => {
		const other = await createTestUser(db);
		const now = new Date('2026-11-02T10:00:00Z');
		await countParse(db, userId, now);
		await countParse(db, userId, now);
		expect(await countParse(db, other, now)).toBe(1);
	});
});

describe('countParse past the limit', () => {
	it('stops counting once past the limit, so blocked sorts leave the stored count alone', async () => {
		const now = new Date('2026-11-02T10:00:00Z');
		const counts = [];
		for (let i = 0; i < DAILY_PARSE_LIMIT + 4; i++) counts.push(await countParse(db, userId, now));
		expect(counts.slice(DAILY_PARSE_LIMIT)).toEqual(Array(4).fill(DAILY_PARSE_LIMIT + 1));
		expect(await parsesToday(db, userId, now)).toBe(DAILY_PARSE_LIMIT + 1);
	});
});

describe('refundParse', () => {
	it('gives back one sort on the day it was counted', async () => {
		const now = new Date('2026-11-02T10:00:00Z');
		await countParse(db, userId, now);
		await countParse(db, userId, now);
		await refundParse(db, userId, now);
		expect(await parsesToday(db, userId, now)).toBe(1);
	});

	it('refunds the day the sort was counted, even after midnight', async () => {
		const counted = new Date('2026-11-02T23:59:59Z');
		const next = new Date('2026-11-03T00:00:01Z');
		await countParse(db, userId, counted);
		await countParse(db, userId, next);
		await refundParse(db, userId, counted);
		expect(await parsesToday(db, userId, counted)).toBe(0);
		expect(await parsesToday(db, userId, next)).toBe(1);
	});

	it('never goes below zero, and touches only that user', async () => {
		const other = await createTestUser(db);
		const now = new Date('2026-11-02T10:00:00Z');
		await countParse(db, other, now);
		await refundParse(db, userId, now);
		expect(await parsesToday(db, userId, now)).toBe(0);
		expect(await parsesToday(db, other, now)).toBe(1);
	});
});

describe('parsesToday', () => {
	it("reads today's count without changing it, and ignores other days", async () => {
		const today = new Date('2026-11-08T10:00:00Z');
		await countParse(db, userId, new Date('2026-11-07T10:00:00Z'));
		expect(await parsesToday(db, userId, today)).toBe(0);
		await countParse(db, userId, today);
		await countParse(db, userId, today);
		expect(await parsesToday(db, userId, today)).toBe(2);
		expect(await parsesToday(db, userId, today)).toBe(2);
	});
});
