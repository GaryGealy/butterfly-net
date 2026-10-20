import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from './db';
import { cards } from './db/schema';
import { DuplicatePileError, LastPileError, NotFoundError, PileNotEmptyError } from './errors';
import {
	DEFAULT_PILES,
	createPile,
	deletePile,
	findPileByName,
	listPiles,
	listPilesWithCounts,
	movePile,
	renamePile,
	seedDefaultPiles
} from './piles';
import { createTestDb, createTestUser } from './test/db';

let db: Db;
let userId: string;

beforeEach(async () => {
	db = createTestDb();
	userId = await createTestUser(db);
	await seedDefaultPiles(db, userId);
});

async function addCard(pileId: string, status: 'active' | 'done' = 'active') {
	await db.insert(cards).values({ user_id: userId, pile_id: pileId, title: 'a card', status });
}

describe('seedDefaultPiles', () => {
	it('creates the five default piles in order', async () => {
		const names = (await listPiles(db, userId)).map((p) => p.name);
		expect(names).toEqual([...DEFAULT_PILES]);
		expect(names).toEqual(['house', 'work stuff', 'ideas', 'video games', 'model building']);
	});
});

describe('createPile', () => {
	it('appends a new pile at the end', async () => {
		const pile = await createPile(db, userId, '  garden ');
		expect(pile.name).toBe('garden');
		const all = await listPiles(db, userId);
		expect(all.at(-1)?.id).toBe(pile.id);
	});

	it('returns the existing pile when the name differs only by case or spacing', async () => {
		const ideas = await findPileByName(db, userId, 'ideas');
		const again = await createPile(db, userId, ' IDEAS ');
		expect(again.id).toBe(ideas?.id);
		expect(await listPiles(db, userId)).toHaveLength(5);
	});
});

describe('renamePile', () => {
	it('renames a pile', async () => {
		const [house] = await listPiles(db, userId);
		await renamePile(db, userId, house.id, 'home');
		expect((await listPiles(db, userId))[0].name).toBe('home');
	});

	it('rejects a name another pile already uses, ignoring case', async () => {
		const [house] = await listPiles(db, userId);
		await expect(renamePile(db, userId, house.id, 'Ideas')).rejects.toThrow(DuplicatePileError);
	});

	it("treats another user's pile as not found", async () => {
		const otherUser = await createTestUser(db);
		await seedDefaultPiles(db, otherUser);
		const [theirs] = await listPiles(db, otherUser);
		await expect(renamePile(db, userId, theirs.id, 'mine now')).rejects.toThrow(NotFoundError);
		expect((await listPiles(db, otherUser))[0].name).toBe('house');
	});
});

describe('movePile', () => {
	it('swaps a pile with its neighbour', async () => {
		const before = await listPiles(db, userId);
		await movePile(db, userId, before[1].id, 'up');
		const after = (await listPiles(db, userId)).map((p) => p.name);
		expect(after.slice(0, 2)).toEqual(['work stuff', 'house']);
	});

	it('does nothing when moving past either end', async () => {
		const before = await listPiles(db, userId);
		await movePile(db, userId, before[0].id, 'up');
		await movePile(db, userId, before[4].id, 'down');
		expect((await listPiles(db, userId)).map((p) => p.id)).toEqual(before.map((p) => p.id));
	});
});

describe('listPilesWithCounts', () => {
	it('counts active and archived cards', async () => {
		const [house] = await listPiles(db, userId);
		await addCard(house.id, 'active');
		await addCard(house.id, 'done');
		const counts = await listPilesWithCounts(db, userId);
		expect(counts[0]).toMatchObject({ name: 'house', card_count: 2 });
		expect(counts[1]).toMatchObject({ name: 'work stuff', card_count: 0 });
	});
});

describe('deletePile', () => {
	it('deletes an empty pile', async () => {
		const [house] = await listPiles(db, userId);
		await deletePile(db, userId, house.id);
		expect((await listPiles(db, userId)).map((p) => p.name)).not.toContain('house');
	});

	it('refuses to delete a pile holding only archived cards without a target', async () => {
		const [house] = await listPiles(db, userId);
		await addCard(house.id, 'done');
		await expect(deletePile(db, userId, house.id)).rejects.toThrow(PileNotEmptyError);
	});

	it('moves every card to the target pile, then deletes', async () => {
		const [house, work] = await listPiles(db, userId);
		await addCard(house.id, 'active');
		await addCard(house.id, 'done');
		await deletePile(db, userId, house.id, work.id);
		const counts = await listPilesWithCounts(db, userId);
		expect(counts.find((p) => p.id === work.id)?.card_count).toBe(2);
	});

	it("rejects another user's pile as the target", async () => {
		const otherUser = await createTestUser(db);
		await seedDefaultPiles(db, otherUser);
		const [theirs] = await listPiles(db, otherUser);
		const [house] = await listPiles(db, userId);
		await addCard(house.id);
		await expect(deletePile(db, userId, house.id, theirs.id)).rejects.toThrow(NotFoundError);
	});

	it('refuses to delete the last remaining pile', async () => {
		const [last, ...rest] = await listPiles(db, userId);
		for (const pile of rest) await deletePile(db, userId, pile.id);
		await expect(deletePile(db, userId, last.id)).rejects.toThrow(LastPileError);
		expect((await listPiles(db, userId)).map((p) => p.id)).toEqual([last.id]);
	});
});
