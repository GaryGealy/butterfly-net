import Anthropic from '@anthropic-ai/sdk';
import type { ParseResult, PileRef } from '../../types';
import { MAX_NOTES_LENGTH, MAX_PILE_NAME_LENGTH, MAX_TITLE_LENGTH } from '../../limits';
import { addDays, isIsoDate, weekdayName } from '../../due';
import { DEFAULT_PRIORITY } from '../../priority';
import { PARSE_JSON_SCHEMA, parsedCardSchema } from './schema';

export const PARSE_MODEL = 'claude-haiku-5-5';
export const PARSE_TIMEOUT_MS = 5000;
export const MAX_PARSED_SUBTASKS = 20;
/** A due date further out than this is more likely a misreading than a plan. */
export const MAX_DUE_DAYS = 730;

export const SYSTEM_PROMPT = `You sort quick notes onto the user's piles, the way someone sorts 3x5 index cards. Each note is something they don't want to forget, usually a someday-task.

The note is often dictated rather than typed, so it may be run-on, lack punctuation, include filler ("um", "so I was thinking", "remind me to"), or contain a misheard word. Read it for what the user meant.

From the user's text, produce:
- title: the note as a short, clear to-do in the user's own words — the gist, not a transcript, under about 8 words; put extra detail in notes. Drop filler; fix only obvious typos and words that were clearly misheard. No trailing period.
- pile: if the user says which pile to use ("on the house pile", "add to work stuff", "new pile called camping"), use that pile: the matching name from the list below, or that name as a new pile with isNewPile set to true. Leave the instruction itself out of the title and notes. Otherwise, the exact name of a pile from the list below when that pile is clearly about the note's subject. Otherwise the note belongs to an area of life none of the piles covers: set pile to a name for that area and isNewPile to true. Don't stretch a pile to hold a note it isn't about. A new pile name is one or two lowercase words naming the area, not the task: "car" for an oil change, "health" for a dentist visit, "food" for a restaurant to try. Never leave pile empty.
- notes: any extra useful detail that doesn't belong in the title (reasons, specifics, context), tidied but not embellished; otherwise an empty string.
- subtasks: only steps or items the text explicitly lists, otherwise an empty array.
- priority: "high" only when the user says it's urgent, important, high priority or needed asap; "low" only when they say low priority, whenever or no rush. Otherwise "medium" — never guess it from the subject or a deadline. Leave those words out of the title and notes.
- dueDate: the day the user says it's due, as YYYY-MM-DD, worked out from today's date below; otherwise an empty string. Only when the text names a day: "tomorrow"; a weekday (the next one, today included; "next friday" is the Friday of next week); a date ("the 15th", "Dec 3"; the next one that isn't in the past); "end of the month" (its last day); "this weekend" (the Saturday); "in 3 days". "By" a day means that day; "before" a day means the day before it. Never from vague times like "soon", "next week", "someday" or "before winter". Leave those words out of the title and notes.

Never invent details the user didn't write.`;

function clamp(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function buildParseRequest(text: string, pileNames: string[], today: string) {
	return {
		model: PARSE_MODEL,
		max_tokens: 2048,
		output_config: {
			effort: 'low' as const,
			format: { type: 'json_schema' as const, schema: PARSE_JSON_SCHEMA }
		},
		system: `${SYSTEM_PROMPT}\n\nThe user's piles:\n${pileNames.map((name) => `- ${name}`).join('\n')}\n\nToday is ${weekdayName(today)}, ${today}.`,
		messages: [{ role: 'user' as const, content: text }]
	};
}

/** The two fields of a Messages API response this module reads. */
interface ParseResponse {
	stop_reason: string | null;
	content: Array<{ type: string; text?: unknown }>;
}

/** `today` is the user's local date, YYYY-MM-DD; a due date before it, or too far past it, is dropped. */
export function interpretResponse(
	response: ParseResponse,
	piles: PileRef[],
	today: string
): ParseResult | null {
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
	const due = parsed.data.dueDate.trim();
	const dueOn = isIsoDate(due) && due >= today && due <= addDays(today, MAX_DUE_DAYS) ? due : null;
	return {
		title: clamp(title, MAX_TITLE_LENGTH),
		pile,
		notes: notes ? notes.slice(0, MAX_NOTES_LENGTH) : null,
		subtasks: parsed.data.subtasks
			.map((s) => s.trim())
			.filter(Boolean)
			.slice(0, MAX_PARSED_SUBTASKS)
			.map((s) => clamp(s, MAX_TITLE_LENGTH)),
		priority: parsed.data.priority,
		dueOn,
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
		priority: DEFAULT_PRIORITY,
		dueOn: null,
		source: 'fallback'
	};
}

/** Never throws: any failure yields fallbackResult, so a capture is never lost. */
export async function parseCapture(
	client: Anthropic | null,
	text: string,
	piles: PileRef[],
	today: string
): Promise<ParseResult> {
	if (!client) return fallbackResult(text);
	try {
		const response = await client.messages.create(
			buildParseRequest(
				text,
				piles.map((p) => p.name),
				today
			),
			{ timeout: PARSE_TIMEOUT_MS, maxRetries: 0 }
		);
		return interpretResponse(response, piles, today) ?? fallbackResult(text);
	} catch (error) {
		console.error(
			'[parse] Claude call failed:',
			error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error
		);
		return fallbackResult(text);
	}
}
