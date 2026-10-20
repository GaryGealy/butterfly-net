import Anthropic from '@anthropic-ai/sdk';
import type { ParseResult, PileRef } from '../../types';
import { PARSE_JSON_SCHEMA, parsedCardSchema } from './schema';

export const PARSE_MODEL = 'claude-haiku-5-5';
export const PARSE_TIMEOUT_MS = 5000;
export const MAX_CAPTURE_LENGTH = 2000;
export const MAX_TITLE_LENGTH = 200;
export const MAX_NOTES_LENGTH = 5000;
export const MAX_PILE_NAME_LENGTH = 40;
export const MAX_PARSED_SUBTASKS = 20;

export const SYSTEM_PROMPT = `You sort quick notes onto the user's piles, the way someone sorts 3x5 index cards. Each note is something they don't want to forget, usually a someday-task.

The note is often dictated rather than typed, so it may be run-on, lack punctuation, include filler ("um", "so I was thinking", "remind me to"), or contain a misheard word. Read it for what the user meant.

From the user's text, produce:
- title: the note as a short, clear to-do in the user's own words — the gist, not a transcript, under about 8 words; put extra detail in notes. Drop filler; fix only obvious typos and words that were clearly misheard. No trailing period.
- pile: the exact name of the best-fitting pile from the list below. Prefer an existing pile whenever it is a reasonable fit. Only if none fits, propose a short, lowercase new pile name and set isNewPile to true.
- notes: any extra useful detail that doesn't belong in the title (reasons, specifics, context), tidied but not embellished; otherwise an empty string.
- subtasks: only steps or items the text explicitly lists, otherwise an empty array.

Never invent details the user didn't write.`;

function clamp(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function buildParseRequest(text: string, pileNames: string[]) {
	return {
		model: PARSE_MODEL,
		max_tokens: 2048,
		output_config: {
			effort: 'low' as const,
			format: { type: 'json_schema' as const, schema: PARSE_JSON_SCHEMA }
		},
		system: `${SYSTEM_PROMPT}\n\nThe user's piles:\n${pileNames.map((name) => `- ${name}`).join('\n')}`,
		messages: [{ role: 'user' as const, content: text }]
	};
}

/** The two fields of a Messages API response this module reads. */
interface ParseResponse {
	stop_reason: string | null;
	content: Array<{ type: string; text?: unknown }>;
}

export function interpretResponse(response: ParseResponse, piles: PileRef[]): ParseResult | null {
	if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return null;

	const block = response.content.find((b) => b.type === 'text' && typeof b.text === 'string');
	if (!block) return null;

	let json: unknown;
	try {
		json = JSON.parse(block.text as string);
	} catch {
		return null;
	}
	const parsed = parsedCardSchema.safeParse(json);
	if (!parsed.success) return null;

	const title = parsed.data.title.trim();
	if (!title) return null;

	const pileName = parsed.data.pile.trim();
	const existing = piles.find((p) => p.name.toLowerCase() === pileName.toLowerCase());
	const pile = existing
		? ({ kind: 'existing', id: existing.id, name: existing.name } as const)
		: pileName
			? ({ kind: 'new', name: pileName.slice(0, MAX_PILE_NAME_LENGTH) } as const)
			: null;

	const notes = parsed.data.notes.trim();
	return {
		title: clamp(title, MAX_TITLE_LENGTH),
		pile,
		notes: notes ? notes.slice(0, MAX_NOTES_LENGTH) : null,
		subtasks: parsed.data.subtasks
			.map((s) => s.trim())
			.filter(Boolean)
			.slice(0, MAX_PARSED_SUBTASKS)
			.map((s) => clamp(s, MAX_TITLE_LENGTH)),
		source: 'claude'
	};
}

/** What the preview shows when Claude can't help: the raw text, no pile. */
export function fallbackResult(text: string): ParseResult {
	const trimmed = text.trim();
	const truncated = trimmed.length > MAX_TITLE_LENGTH;
	return {
		title: clamp(trimmed, MAX_TITLE_LENGTH),
		pile: null,
		notes: truncated ? trimmed.slice(0, MAX_NOTES_LENGTH) : null,
		subtasks: [],
		source: 'fallback'
	};
}

/** Never throws: any failure yields fallbackResult, so a capture is never lost. */
export async function parseCapture(
	client: Anthropic | null,
	text: string,
	piles: PileRef[]
): Promise<ParseResult> {
	if (!client) return fallbackResult(text);
	try {
		const response = await client.messages.create(
			buildParseRequest(
				text,
				piles.map((p) => p.name)
			),
			{ timeout: PARSE_TIMEOUT_MS, maxRetries: 0 }
		);
		return interpretResponse(response, piles) ?? fallbackResult(text);
	} catch (error) {
		console.error(
			'[parse] Claude call failed:',
			error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error
		);
		return fallbackResult(text);
	}
}
