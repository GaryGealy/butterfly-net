import { fail } from '@sveltejs/kit';
import { listActiveCardsByPile, markDone, reopenCard } from '../lib/server/cards';
import { NotFoundError } from '../lib/server/errors';
import { requireUser } from '../lib/server/routes';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	return { piles: await listActiveCardsByPile(locals.db, user.id) };
};

async function withCardId(
	request: Request,
	run: (id: string) => Promise<void>
): Promise<ReturnType<typeof fail> | undefined> {
	const id = String((await request.formData()).get('id') ?? '');
	try {
		await run(id);
	} catch (e) {
		if (e instanceof NotFoundError) return fail(404, { error: 'Card not found' });
		throw e;
	}
}

export const actions: Actions = {
	done: async ({ locals, request }) => {
		const user = requireUser(locals);
		return withCardId(request, (id) => markDone(locals.db, user.id, id));
	},
	reopen: async ({ locals, request }) => {
		const user = requireUser(locals);
		return withCardId(request, (id) => reopenCard(locals.db, user.id, id));
	}
};
