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

afterEach(() => vi.restoreAllMocks());

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
	...overrides
});

function clientReturning(result: Promise<unknown>) {
	const create = vi.fn().mockReturnValue(result);
	return { client: { messages: { create } } as unknown as Anthropic, create };
}

describe('buildParseRequest', () => {
	it('asks the configured model for structured output', () => {
		const request = buildParseRequest('get resin', ['house', 'ideas']);
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
		expect(buildParseRequest('get resin', ['house']).system).toMatch(/dictated/);
	});
});

describe('interpretResponse', () => {
	it('maps an existing pile to its id', () => {
		expect(interpretResponse(reply(card()), piles)).toEqual({
			title: 'Buy resin for the X-wing',
			pile: { kind: 'existing', id: 'p-models', name: 'model building' },
			notes: null,
			subtasks: [],
			source: 'claude'
		});
	});

	it('treats a case- or space-variant of an existing pile as that pile', () => {
		const result = interpretResponse(reply(card({ pile: ' Ideas ', isNewPile: true })), piles);
		expect(result?.pile).toEqual({ kind: 'existing', id: 'p-ideas', name: 'ideas' });
	});

	it('proposes a new pile, even when Claude forgot to flag it', () => {
		const result = interpretResponse(reply(card({ pile: 'garden', isNewPile: false })), piles);
		expect(result?.pile).toEqual({ kind: 'new', name: 'garden' });
	});

	it('keeps notes and trims, drops blank, and caps subtasks', () => {
		const many = Array.from({ length: 30 }, (_, i) => `step ${i}`);
		const result = interpretResponse(
			reply(card({ notes: '  gloss finish ', subtasks: [' sand ', '', ...many] })),
			piles
		);
		expect(result?.notes).toBe('gloss finish');
		expect(result?.subtasks[0]).toBe('sand');
		expect(result?.subtasks).toHaveLength(20);
	});

	it('returns null for a refusal, a truncated reply, invalid JSON, or the wrong shape', () => {
		expect(interpretResponse(reply(card(), 'refusal'), piles)).toBeNull();
		expect(interpretResponse(reply(card(), 'max_tokens'), piles)).toBeNull();
		expect(interpretResponse(reply('{not json'), piles)).toBeNull();
		expect(interpretResponse(reply({ title: 'x' }), piles)).toBeNull();
		expect(interpretResponse(reply(card({ title: '   ' })), piles)).toBeNull();
		expect(interpretResponse({ stop_reason: 'end_turn', content: [] }, piles)).toBeNull();
	});
});

describe('fallbackResult', () => {
	it('uses the raw text as the title with no pile', () => {
		expect(fallbackResult('  call the plumber ')).toEqual({
			title: 'call the plumber',
			pile: null,
			notes: null,
			subtasks: [],
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
		const result = await parseCapture(client, 'get resin for the x-wing', piles);
		expect(result.source).toBe('claude');
		expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: PARSE_MODEL }), {
			timeout: PARSE_TIMEOUT_MS,
			maxRetries: 0
		});
	});

	it('falls back when the call throws (outage or timeout)', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = clientReturning(Promise.reject(new Error('Request timed out.')));
		expect(await parseCapture(client, 'call the plumber', piles)).toEqual(
			fallbackResult('call the plumber')
		);
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it('falls back when the reply is unusable', async () => {
		const { client } = clientReturning(Promise.resolve(reply(card(), 'refusal')));
		expect((await parseCapture(client, 'call the plumber', piles)).source).toBe('fallback');
	});

	it('falls back without a client (no API key configured)', async () => {
		expect((await parseCapture(null, 'call the plumber', piles)).source).toBe('fallback');
	});
});
