import { createCard } from './cards';
import type { Db } from './db';
import { createPile } from './piles';
import type { CaptureSave } from './validation';

/** Saves a confirmed preview, creating the pile first if the user accepted a new one. */
export async function saveCapture(db: Db, userId: string, input: CaptureSave): Promise<string> {
	const pileId =
		input.pile.kind === 'existing'
			? input.pile.id
			: (await createPile(db, userId, input.pile.name)).id;
	return createCard(db, userId, {
		title: input.title,
		notes: input.notes,
		pileId,
		subtasks: input.subtasks
	});
}
