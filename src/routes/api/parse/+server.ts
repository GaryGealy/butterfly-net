import { error, json } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { DAILY_PARSE_LIMIT, MAX_CAPTURE_LENGTH } from '../../../lib/limits';
import { getParseClient } from '../../../lib/server/parse/client';
import { fallbackResult, parseCapture } from '../../../lib/server/parse/parse';
import { listPiles } from '../../../lib/server/piles';
import { requireUser } from '../../../lib/server/routes';
import { countParse } from '../../../lib/server/usage';
import type { ParseResult } from '../../../lib/types';
import type { RequestHandler } from './$types';

const bodySchema = z.object({ text: z.string().trim().min(1).max(MAX_CAPTURE_LENGTH) });

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireUser(locals);
	const body = bodySchema.safeParse(await request.json().catch(() => null));
	if (!body.success) error(400, `Text must be 1–${MAX_CAPTURE_LENGTH} characters`);

	// Admins aren't counted. Everyone else gets DAILY_PARSE_LIMIT sorts a UTC day; past that the
	// capture still works, without Claude.
	if (!locals.isAdmin && (await countParse(locals.db, user.id)) > DAILY_PARSE_LIMIT) {
		return json({ ...fallbackResult(body.data.text), source: 'limit' } satisfies ParseResult);
	}

	const piles = await listPiles(locals.db, user.id);
	const client = getParseClient(env.ANTHROPIC_API_KEY);
	return json(await parseCapture(client, body.data.text, piles));
};
