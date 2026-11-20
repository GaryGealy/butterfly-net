import type Anthropic from '@anthropic-ai/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_TITLE_LENGTH } from '../../limits';
import type { PileRef } from '../../types';
import {
	PARSE_MODEL,
	PARSE_TIMEOUT_MS,
	buildParseRequest,
	fallbackResult,
	interpretResponse,
	parseCapture
} from './parse';
import { PARSE_JSON_SCHEMA } from './schema';

afterEach(() => vi.restoreAllMocks());

const TODAY = '2026-11-20'; // a Friday

const piles: PileRef[] = [
	{ id: 'p-house', name: 'house' },
	{ id: 'p-ideas', name: 'ideas' },
	{ id: 'p-models', name: 'model building' }
];

const reply = (body: unknown, stop_reason = 'end_turn') => ({
	stop_reason,
	content: [
		{ type: 'thinking', thinking: '' },
		{ type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) }
	]
});

const card = (overrides: Record<string, unknown> = {}) => ({
	title: 'Buy resin for the X-wing',
	pile: 'model building',
	isNewPile: false,
	notes: '',
	subtasks: [],
	priority: 'medium',
	dueDate: '',
	...overrides
});

function clientReturning(result: Promise<unknown>) {
	const create = vi.fn().mockReturnValue(result);
	return { client: { messages: { create } } as unknown as Anthropic, create };
}

describe('buildParseRequest', () => {
	it('asks the configured model for structured output', () => {
		const request = buildParseRequest('get resin', ['house', 'ideas'], TODAY);
		expect(request.model).toBe(PARSE_MODEL);
		expect(PARSE_MODEL).toBe('claude-haiku-5-5');
		expect(request.output_config.effort).toBe('low');
		expect(request.output_config.format.type).toBe('json_schema');
		expect(request).not.toHaveProperty('fallbacks');
		expect(request).not.toHaveProperty('betas');
		expect(request.system).toContain('- house\n- ideas');
		expect(request.messages).toEqual([{ role: 'user', content: 'get resin' }]);
	});

	it('tells Claude the note is often dictated', () => {
		expect(buildParseRequest('get resin', ['house'], TODAY).system).toMatch(/dictated/);
	});

	it('asks for a priority and explains when to set it', () => {
		const schema = PARSE_JSON_SCHEMA as {
			properties: Record<string, { enum?: string[] }>;
			required: string[];
		};
		expect(schema.properties.priority.enum).toEqual(['low', 'medium', 'high']);
		expect(schema.required).toContain('priority');
		const system = buildParseRequest('get resin', ['house'], TODAY).system;
		expect(system).toMatch(/urgent/);
		expect(system).toMatch(/no rush/);
	});

	it('asks for a due date, tells Claude today with its weekday, and explains when to set one', () => {
		const schema = PARSE_JSON_SCHEMA as {
			properties: Record<string, { type?: string }>;
			required: string[];
		};
		expect(schema.properties.dueDate.type).toBe('string');
		expect(schema.required).toContain('dueDate');
		const system = buildParseRequest('get resin', ['house'], TODAY).system;
		expect(system).toContain('Today is Friday, 2026-11-20.');
		expect(system).toMatch(/dueDate/);
		expect(system).toMatch(/before/);
		expect(system).toMatch(/soon/);
	});
});

describe('interpretResponse', () => {
	it('maps an existing pile to its id', () => {
		expect(interpretResponse(reply(card()), piles, TODAY)).toEqual({
			title: 'Buy resin for the X-wing',
			pile: { kind: 'existing', id: 'p-models', name: 'model building' },
			notes: null,
			subtasks: [],
			priority: 'medium',
			dueOn: null,
			source: 'claude'
		});
	});

	it('treats a case- or space-variant of an existing pile as that pile', () => {
		const result = interpretResponse(
			reply(card({ pile: ' Ideas ', isNewPile: true })),
			piles,
			TODAY
		);
		expect(result?.pile).toEqual({ kind: 'existing', id: 'p-ideas', name: 'ideas' });
	});

	it('proposes a new pile, even when Claude forgot to flag it', () => {
		const result = interpretResponse(
			reply(card({ pile: 'garden', isNewPile: false })),
			piles,
			TODAY
		);
		expect(result?.pile).toEqual({ kind: 'new', name: 'garden' });
	});

	it('keeps notes and trims, drops blank, and caps subtasks', () => {
		const many = Array.from({ length: 30 }, (_, i) => `step ${i}`);
		const result = interpretResponse(
			reply(card({ notes: '  gloss finish ', subtasks: [' sand ', '', ...many] })),
			piles,
			TODAY
		);
		expect(result?.notes).toBe('gloss finish');
		expect(result?.subtasks[0]).toBe('sand');
		expect(result?.subtasks).toHaveLength(20);
	});

	it("maps the reply's priority", () => {
		expect(interpretResponse(reply(card({ priority: 'high' })), piles, TODAY)?.priority).toBe(
			'high'
		);
		expect(interpretResponse(reply(card({ priority: 'low' })), piles, TODAY)?.priority).toBe('low');
	});

	it("maps the reply's due date, and an empty one to null", () => {
		expect(interpretResponse(reply(card({ dueDate: '2026-11-27' })), piles, TODAY)?.dueOn).toBe(
			'2026-11-27'
		);
		expect(interpretResponse(reply(card({ dueDate: TODAY })), piles, TODAY)?.dueOn).toBe(TODAY);
		expect(interpretResponse(reply(card()), piles, TODAY)?.dueOn).toBeNull();
	});

	it('drops a past, impossible or far-off due date and keeps the rest of the reply', () => {
		for (const dueDate of ['2026-11-19', '2026-02-30', 'friday', '2028-11-21']) {
			const result = interpretResponse(reply(card({ dueDate })), piles, TODAY);
			expect(result?.dueOn).toBeNull();
			expect(result?.title).toBe('Buy resin for the X-wing');
			expect(result?.pile).toEqual({ kind: 'existing', id: 'p-models', name: 'model building' });
		}
		expect(interpretResponse(reply(card({ dueDate: '2028-11-19' })), piles, TODAY)?.dueOn).toBe(
			'2028-11-19'
		);
	});

	it('rejects a reply with an unknown priority', () => {
		expect(interpretResponse(reply(card({ priority: 'urgent' })), piles, TODAY)).toBeNull();
	});

	it('returns null for a refusal, a truncated reply, invalid JSON, or the wrong shape', () => {
		expect(interpretResponse(reply(card(), 'refusal'), piles, TODAY)).toBeNull();
		expect(interpretResponse(reply(card(), 'max_tokens'), piles, TODAY)).toBeNull();
		expect(interpretResponse(reply('{not json'), piles, TODAY)).toBeNull();
		expect(interpretResponse(reply({ title: 'x' }), piles, TODAY)).toBeNull();
		expect(interpretResponse(reply(card({ title: '   ' })), piles, TODAY)).toBeNull();
		expect(interpretResponse({ stop_reason: 'end_turn', content: [] }, piles, TODAY)).toBeNull();
	});
});

describe('fallbackResult', () => {
	it('uses the raw text as the title with no pile', () => {
		expect(fallbackResult('  call the plumber ')).toEqual({
			title: 'call the plumber',
			pile: null,
			notes: null,
			subtasks: [],
			priority: 'medium',
			dueOn: null,
			source: 'fallback'
		});
	});

	it('truncates a long capture and keeps the full text in notes', () => {
		const long = 'word '.repeat(100).trim(); // 499 chars
		const result = fallbackResult(long);
		expect(result.title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
		expect(result.title.endsWith('…')).toBe(true);
		expect(result.notes).toBe(long);
	});
});

describe('parseCapture', () => {
	it("returns Claude's card and passes the timeout with no retries", async () => {
		const { client, create } = clientReturning(Promise.resolve(reply(card())));
		const result = await parseCapture(client, 'get resin for the x-wing', piles, TODAY);
		expect(result.source).toBe('claude');
		expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: PARSE_MODEL }), {
			timeout: PARSE_TIMEOUT_MS,
			maxRetries: 0
		});
	});

	it('falls back when the call throws (outage or timeout)', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = clientReturning(Promise.reject(new Error('Request timed out.')));
		expect(await parseCapture(client, 'call the plumber', piles, TODAY)).toEqual(
			fallbackResult('call the plumber')
		);
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it('falls back when the reply is unusable', async () => {
		const { client } = clientReturning(Promise.resolve(reply(card(), 'refusal')));
		expect((await parseCapture(client, 'call the plumber', piles, TODAY)).source).toBe('fallback');
	});

	it('falls back without a client (no API key configured)', async () => {
		expect((await parseCapture(null, 'call the plumber', piles, TODAY)).source).toBe('fallback');
	});
});
