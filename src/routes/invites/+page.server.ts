import { createInvite, listInvites, revokeInvite } from '../../lib/server/invites';
import { requireAdmin } from '../../lib/server/routes';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireAdmin(locals);
	return { origin: url.origin, ...(await listInvites(locals.db)) };
};

export const actions: Actions = {
	create: async ({ locals, url }) => {
		const admin = requireAdmin(locals);
		const { code } = await createInvite(locals.db, admin.id);
		return { created: `${url.origin}/welcome?invite=${code}` };
	},
	revoke: async ({ locals, request }) => {
		requireAdmin(locals);
		await revokeInvite(locals.db, String((await request.formData()).get('id') ?? ''));
	}
};
