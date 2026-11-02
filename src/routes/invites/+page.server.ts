import { error } from '@sveltejs/kit';
import { createInvite, listInvites, revokeInvite } from '../../lib/server/invites';
import { requireUser } from '../../lib/server/routes';
import type { Actions, PageServerLoad } from './$types';

/** Non-admins get a 404, so the page's existence isn't revealed. */
function requireAdmin(locals: App.Locals) {
	const user = requireUser(locals);
	if (!locals.isAdmin) error(404, 'Not found');
	return user;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	requireAdmin(locals);
	return { origin: url.origin, ...(await listInvites(locals.db)) };
};

export const actions: Actions = {
	create: async ({ locals, url }) => {
		const admin = requireAdmin(locals);
		const { code } = await createInvite(locals.db, admin.id);
		return { created: `${url.origin}/signup?invite=${code}` };
	},
	revoke: async ({ locals, request }) => {
		requireAdmin(locals);
		await revokeInvite(locals.db, String((await request.formData()).get('id') ?? ''));
	}
};
