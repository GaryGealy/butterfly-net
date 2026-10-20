import { listPiles } from '../../lib/server/piles';
import { requireUser } from '../../lib/server/routes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	const piles = await listPiles(locals.db, user.id);
	return { piles: piles.map(({ id, name }) => ({ id, name })) };
};
