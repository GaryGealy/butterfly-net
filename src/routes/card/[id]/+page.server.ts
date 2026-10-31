import { error, fail, redirect } from '@sveltejs/kit';
import { MAX_SUBTASKS, MAX_TITLE_LENGTH } from '../../../lib/limits';
import {
	deleteCard,
	getCard,
	markDone,
	reopenCard,
	setSubtasks,
	updateCard
} from '../../../lib/server/cards';
import { NotFoundError } from '../../../lib/server/errors';
import { listPiles } from '../../../lib/server/piles';
import { requireUser } from '../../../lib/server/routes';
import { cardEditSchema } from '../../../lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = requireUser(locals);
	const card = await getCard(locals.db, user.id, params.id);
	if (!card) error(404, 'Card not found');
	return { card, piles: await listPiles(locals.db, user.id), now: new Date() };
};

async function orNotFound(run: () => Promise<void>): Promise<void> {
	try {
		await run();
	} catch (e) {
		if (e instanceof NotFoundError) error(404, 'Card not found');
		throw e;
	}
}

export const actions: Actions = {
	save: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const parsed = cardEditSchema.safeParse({
			title: form.get('title'),
			notes: form.get('notes'),
			pileId: form.get('pileId')
		});
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });

		const doneRows = new Set(form.getAll('subtask_done').map(String));
		const items = form
			.getAll('subtask_text')
			.map((value, i) => ({
				text: String(value).trim().slice(0, MAX_TITLE_LENGTH),
				done: doneRows.has(String(i))
			}))
			.filter((item) => item.text.length > 0)
			.slice(0, MAX_SUBTASKS);

		await orNotFound(async () => {
			await updateCard(locals.db, user.id, params.id, parsed.data);
			await setSubtasks(locals.db, user.id, params.id, items);
		});
		return { saved: true };
	},
	done: async ({ locals, params }) => {
		const user = requireUser(locals);
		await orNotFound(() => markDone(locals.db, user.id, params.id));
	},
	reopen: async ({ locals, params }) => {
		const user = requireUser(locals);
		await orNotFound(() => reopenCard(locals.db, user.id, params.id));
	},
	delete: async ({ locals, params }) => {
		const user = requireUser(locals);
		await orNotFound(() => deleteCard(locals.db, user.id, params.id));
		redirect(303, '/');
	}
};
