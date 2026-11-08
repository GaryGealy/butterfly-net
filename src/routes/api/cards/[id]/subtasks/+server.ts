import { error, json } from '@sveltejs/kit';
import { appendSubtasks } from '../../../../../lib/server/cards';
import { NotFoundError } from '../../../../../lib/server/errors';
import { requireUser } from '../../../../../lib/server/routes';
import { appendStepsSchema } from '../../../../../lib/server/validation';
import type { RequestHandler } from './$types';

/** Appends the Break it down steps the user kept; returns only the rows it inserted. */
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireUser(locals);
	const body = appendStepsSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) error(400, body.error.issues[0]?.message ?? 'Invalid steps');
	try {
		return json({ subtasks: await appendSubtasks(locals.db, user.id, params.id, body.data.steps) });
	} catch (e) {
		if (e instanceof NotFoundError) error(404, 'Card not found');
		throw e;
	}
};
