import { fail } from '@sveltejs/kit';
import { localDay, TZ_COOKIE } from '../lib/due';
import { listActiveCardsByPile, markDone, moveCard, reopenCard } from '../lib/server/cards';
import { NotFoundError } from '../lib/server/errors';
import { requireUser } from '../lib/server/routes';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	const user = requireUser(locals);
	// `now` and `today` travel with the data so server and browser agree on ages and due labels.
	const now = new Date();
	return {
		piles: await listActiveCardsByPile(locals.db, user.id),
		now,
		today: localDay(now, cookies.get(TZ_COOKIE))
	};
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
	},
	move: async ({ locals, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		try {
			const from = await moveCard(
				locals.db,
				user.id,
				String(form.get('id') ?? ''),
				String(form.get('pileId') ?? '')
			);
			return { from };
		} catch (e) {
			if (e instanceof NotFoundError) return fail(404, { error: 'Card or pile not found' });
			throw e;
		}
	}
};
