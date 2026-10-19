import { fail } from '@sveltejs/kit';
import { listArchivedCards, reopenCard } from '../../lib/server/cards';
import { NotFoundError } from '../../lib/server/errors';
import { requireUser } from '../../lib/server/routes';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	return { cards: await listArchivedCards(locals.db, user.id) };
};

export const actions: Actions = {
	reopen: async ({ locals, request }) => {
		const user = requireUser(locals);
		const id = String((await request.formData()).get('id') ?? '');
		try {
			await reopenCard(locals.db, user.id, id);
		} catch (e) {
			if (e instanceof NotFoundError) return fail(404, { error: 'Card not found' });
			throw e;
		}
	}
};
