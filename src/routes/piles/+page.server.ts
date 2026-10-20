import { fail } from '@sveltejs/kit';
import {
	DuplicatePileError,
	LastPileError,
	NotFoundError,
	PileNotEmptyError
} from '../../lib/server/errors';
import {
	createPile,
	deletePile,
	listPilesWithCounts,
	movePile,
	renamePile
} from '../../lib/server/piles';
import { requireUser } from '../../lib/server/routes';
import { pileNameSchema } from '../../lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	return { piles: await listPilesWithCounts(locals.db, user.id) };
};

/** Runs a pile change and turns expected errors into a form message. */
async function attempt(run: () => Promise<unknown>) {
	try {
		await run();
	} catch (e) {
		if (e instanceof DuplicatePileError) return fail(400, { error: e.message });
		if (e instanceof LastPileError) return fail(400, { error: e.message });
		if (e instanceof PileNotEmptyError)
			return fail(400, { error: 'Choose where this pile’s cards should go first' });
		if (e instanceof NotFoundError) return fail(404, { error: 'Pile not found' });
		throw e;
	}
}

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const user = requireUser(locals);
		const name = pileNameSchema.safeParse((await request.formData()).get('name'));
		if (!name.success) return fail(400, { error: name.error.issues[0].message });
		return attempt(() => createPile(locals.db, user.id, name.data));
	},
	rename: async ({ locals, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const name = pileNameSchema.safeParse(form.get('name'));
		if (!name.success) return fail(400, { error: name.error.issues[0].message });
		return attempt(() => renamePile(locals.db, user.id, String(form.get('id')), name.data));
	},
	move: async ({ locals, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const direction = form.get('direction') === 'up' ? 'up' : 'down';
		return attempt(() => movePile(locals.db, user.id, String(form.get('id')), direction));
	},
	delete: async ({ locals, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const reassignTo = form.get('reassignTo');
		return attempt(() =>
			deletePile(
				locals.db,
				user.id,
				String(form.get('id')),
				reassignTo ? String(reassignTo) : undefined
			)
		);
	}
};
