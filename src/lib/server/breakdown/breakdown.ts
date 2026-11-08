import Anthropic from '@anthropic-ai/sdk';
import { MAX_TITLE_LENGTH } from '../../limits';
import { httpUrl, sameStepText, sameUrl } from '../links';
import { PARSE_MODEL } from '../parse/parse';
import { BREAKDOWN_JSON_SCHEMA, breakdownReplySchema } from './schema';

/** Web search makes this slower than a capture sort; the capture timeout stays 5 s. */
export const BREAKDOWN_TIMEOUT_MS = 30_000;
export const MAX_BREAKDOWN_STEPS = 8;
export const BREAKDOWN_MAX_SEARCHES = 4;

export interface BreakdownCard {
	title: string;
	notes: string | null;
	pileName: string;
	subtasks: string[];
}

export interface ProposedStep {
	text: string;
	url: string | null;
	linkTitle: string | null;
}

export const BREAKDOWN_PROMPT = `You help someone turn one of their 3x5 cards into concrete next steps. The card is something they want to do; it may be a small project or something to learn.

Break the card into 3 to ${MAX_BREAKDOWN_STEPS} steps, in a sensible order. Each step is a short action in plain words, under about 8 words, like a card title. No trailing period. Don't repeat a subtask the card already has.

For steps about learning something (watching, reading, studying), search the web and attach the single best resource: a video, article, tutorial, or paper. Prefer well-known, free sources. A step's url must be copied exactly from a web search result, and linkTitle is that result's title. Never write a URL from memory. If no search result fits a step, leave url and linkTitle as empty strings. Steps that are about doing rather than learning have no link.`;

function clamp(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function buildBreakdownRequest(card: BreakdownCard) {
	const lines = [`Card: ${card.title}`, `Pile: ${card.pileName}`];
	if (card.notes) lines.push(`Notes: ${card.notes}`);
	if (card.subtasks.length > 0) {
		lines.push('Subtasks it already has:', ...card.subtasks.map((s) => `- ${s}`));
	}
	return {
		model: PARSE_MODEL,
		max_tokens: 4096,
		output_config: {
			effort: 'low' as const,
			format: { type: 'json_schema' as const, schema: BREAKDOWN_JSON_SCHEMA }
		},
		tools: [
			{
				type: 'web_search_20250305' as const,
				name: 'web_search' as const,
				max_uses: BREAKDOWN_MAX_SEARCHES
			}
		],
		system: BREAKDOWN_PROMPT,
		messages: [{ role: 'user' as const, content: lines.join('\n') }]
	};
}

/** The fields of a Messages API response this module reads. */
interface BreakdownResponse {
	stop_reason: string | null;
	content: Array<{ type: string; [key: string]: unknown }>;
}

interface SearchHit {
	url: string;
	title: string;
}

/** Every http(s) result from the response's successful web searches. */
function searchHits(response: BreakdownResponse): SearchHit[] {
	const hits: SearchHit[] = [];
	for (const block of response.content) {
		// A failed search's content is an error object, not a list.
		if (block.type !== 'web_search_tool_result' || !Array.isArray(block.content)) continue;
		for (const result of block.content as Array<Record<string, unknown>>) {
			const url = httpUrl(result.url);
			if (url) hits.push({ url, title: typeof result.title === 'string' ? result.title : '' });
		}
	}
	return hits;
}

/**
 * The proposed steps, or null when the reply is unusable. A step keeps its link only when the
 * URL was one of this response's search results, and then takes that result's URL and title.
 */
export function interpretBreakdown(
	response: BreakdownResponse,
	existing: string[]
): ProposedStep[] | null {
	if (response.stop_reason !== 'end_turn') return null;

	// Web search replies have text before and between tool blocks; the answer is the last one.
	const last = response.content
		.filter((b) => b.type === 'text' && typeof b.text === 'string')
		.at(-1);
	if (!last) return null;

	let json: unknown;
	try {
		json = JSON.parse(last.text as string);
	} catch {
		return null;
	}
	const parsed = breakdownReplySchema.safeParse(json);
	if (!parsed.success) return null;

	const hits = searchHits(response);
	const seen = [...existing];
	const steps: ProposedStep[] = [];
	for (const raw of parsed.data.steps) {
		const text = raw.text.trim();
		if (!text || seen.some((s) => sameStepText(s, text))) continue;
		seen.push(text);
		const hit = raw.url ? hits.find((h) => sameUrl(h.url, raw.url)) : undefined;
		steps.push({
			text: clamp(text, MAX_TITLE_LENGTH),
			url: hit?.url ?? null,
			linkTitle: hit ? clamp(hit.title.trim() || hit.url, MAX_TITLE_LENGTH) : null
		});
		if (steps.length === MAX_BREAKDOWN_STEPS) break;
	}
	return steps.length > 0 ? steps : null;
}

/** Never throws: any failure yields null, and the caller adds nothing. */
export async function breakdownCard(
	client: Anthropic | null,
	card: BreakdownCard
): Promise<ProposedStep[] | null> {
	if (!client) return null;
	try {
		const response = await client.messages.create(buildBreakdownRequest(card), {
			timeout: BREAKDOWN_TIMEOUT_MS,
			maxRetries: 0
		});
		return interpretBreakdown(response as unknown as BreakdownResponse, card.subtasks);
	} catch (error) {
		console.error(
			'[breakdown] Claude call failed:',
			error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error
		);
		return null;
	}
}
