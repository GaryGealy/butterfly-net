import { error, json } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { DAILY_PARSE_LIMIT } from '../../../../../lib/limits';
import { breakdownCard } from '../../../../../lib/server/breakdown/breakdown';
import { getCard } from '../../../../../lib/server/cards';
import { getParseClient } from '../../../../../lib/server/parse/client';
import { requireUser } from '../../../../../lib/server/routes';
import { countParse } from '../../../../../lib/server/usage';
import type { RequestHandler } from './$types';

/** Proposes steps for a card. A press counts as one of the day's Claude sorts. */
export const POST: RequestHandler = async ({ locals, params }) => {
	const user = requireUser(locals);
	// Look the card up first, so a bad id never spends a sort.
	const card = await getCard(locals.db, user.id, params.id);
	if (!card) error(404, 'Card not found');
	if (card.status !== 'active') error(400, 'Only active cards can be broken down');

	let sortsLeft: number | null = null;
	if (!locals.isAdmin) {
		const used = await countParse(locals.db, user.id);
		if (used > DAILY_PARSE_LIMIT)
			return json({ error: 'out-of-sorts', sortsLeft: 0 }, { status: 429 });
		sortsLeft = DAILY_PARSE_LIMIT - used;
	}

	const steps = await breakdownCard(getParseClient(env.ANTHROPIC_API_KEY), {
		title: card.title,
		notes: card.notes,
		pileName: card.pile_name,
		subtasks: card.subtasks.map((s) => s.text)
	});
	if (!steps) return json({ error: 'failed', sortsLeft }, { status: 502 });
	return json({ steps, sortsLeft });
};
