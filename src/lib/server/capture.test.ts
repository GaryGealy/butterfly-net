import { beforeEach, describe, expect, it } from 'vitest';
import { saveCapture } from './capture';
import { getCard } from './cards';
import type { Db } from './db';
import { NotFoundError } from './errors';
import { listPiles, seedDefaultPiles } from './piles';
import { createTestDb, createTestUser } from './test/db';

let db: Db;
let userId: string;

beforeEach(async () => {
	db = createTestDb();
	userId = await createTestUser(db);
	await seedDefaultPiles(db, userId);
});

const capture = { title: 'Plant tomatoes', notes: null, subtasks: ['Buy seedlings'] };

describe('saveCapture', () => {
	it('files the card on an existing pile', async () => {
		const [house] = await listPiles(db, userId);
		const id = await saveCapture(db, userId, {
			...capture,
			pile: { kind: 'existing', id: house.id }
		});
		expect(await getCard(db, userId, id)).toMatchObject({
			title: 'Plant tomatoes',
			pile_name: 'house'
		});
	});

	it('creates an accepted new pile and files the card there', async () => {
		const id = await saveCapture(db, userId, { ...capture, pile: { kind: 'new', name: 'garden' } });
		expect((await getCard(db, userId, id))?.pile_name).toBe('garden');
		expect((await listPiles(db, userId)).map((p) => p.name)).toContain('garden');
	});

	it('reuses an existing pile when the "new" name only differs by case', async () => {
		await saveCapture(db, userId, { ...capture, pile: { kind: 'new', name: 'IDEAS' } });
		expect(await listPiles(db, userId)).toHaveLength(5);
	});

	it("rejects another user's pile", async () => {
		const other = await createTestUser(db);
		await seedDefaultPiles(db, other);
		const [theirs] = await listPiles(db, other);
		await expect(
			saveCapture(db, userId, { ...capture, pile: { kind: 'existing', id: theirs.id } })
		).rejects.toThrow(NotFoundError);
	});
});
