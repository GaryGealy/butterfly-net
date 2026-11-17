import { fail } from '@sveltejs/kit';
import { createInvite, listInvites, revokeInvite } from '../../lib/server/invites';
import { requireAdmin } from '../../lib/server/routes';
import { inviteLabelSchema } from '../../lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireAdmin(locals);
	return { origin: url.origin, ...(await listInvites(locals.db)) };
};

export const actions: Actions = {
	create: async ({ locals, request, url }) => {
		const admin = requireAdmin(locals);
		const raw = (await request.formData()).get('label');
		const parsed = inviteLabelSchema.safeParse(typeof raw === 'string' ? raw : null);
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0].message, label: String(raw ?? '') });
		}
		const { code, label } = await createInvite(locals.db, admin.id, new Date(), parsed.data);
		return { created: `${url.origin}/welcome?invite=${code}`, label };
	},
	revoke: async ({ locals, request }) => {
		requireAdmin(locals);
		await revokeInvite(locals.db, String((await request.formData()).get('id') ?? ''));
	}
};
