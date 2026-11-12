import { error, fail, redirect } from '@sveltejs/kit';
import { deleteCard, getCard, markDone, reopenCard, saveCard } from '../../../lib/server/cards';
import { DAILY_PARSE_LIMIT } from '../../../lib/limits';
import { NotFoundError } from '../../../lib/server/errors';
import { listPiles } from '../../../lib/server/piles';
import { requireUser } from '../../../lib/server/routes';
import { parsesToday } from '../../../lib/server/usage';
import { cardEditSchema, subtaskRowsFromForm } from '../../../lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = requireUser(locals);
	const card = await getCard(locals.db, user.id, params.id);
	if (!card) error(404, 'Card not found');
	// Admins aren't counted, so they have no allowance to show.
	const sortsLeft = locals.isAdmin
		? null
		: Math.max(0, DAILY_PARSE_LIMIT - (await parsesToday(locals.db, user.id)));
	return { card, piles: await listPiles(locals.db, user.id), now: new Date(), sortsLeft };
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

		const items = subtaskRowsFromForm(form);

		await orNotFound(() => saveCard(locals.db, user.id, params.id, parsed.data, items));
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
