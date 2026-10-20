import { error, json } from '@sveltejs/kit';
import { saveCapture } from '../../../lib/server/capture';
import { NotFoundError } from '../../../lib/server/errors';
import { requireUser } from '../../../lib/server/routes';
import { captureSaveSchema } from '../../../lib/server/validation';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireUser(locals);
	const body = captureSaveSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) error(400, body.error.issues[0]?.message ?? 'Invalid card');

	try {
		const id = await saveCapture(locals.db, user.id, body.data);
		return json({ id }, { status: 201 });
	} catch (e) {
		if (e instanceof NotFoundError) error(404, 'Pile not found');
		throw e;
	}
};
