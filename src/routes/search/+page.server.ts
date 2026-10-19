import { requireUser } from '../../lib/server/routes';
import { searchCards } from '../../lib/server/search';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUser(locals);
	const q = url.searchParams.get('q') ?? '';
	return { q, results: q.trim() ? await searchCards(locals.db, user.id, q) : null };
};
