import type Anthropic from '@anthropic-ai/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_TITLE_LENGTH } from '../../limits';
import { fakeParseClient } from '../parse/fake-client';
import {
	BREAKDOWN_TIMEOUT_MS,
	MAX_BREAKDOWN_STEPS,
	breakdownCard,
	buildBreakdownRequest,
	interpretBreakdown,
	type BreakdownCard
} from './breakdown';

afterEach(() => vi.restoreAllMocks());

const card: BreakdownCard = {
	title: 'Learn more about graphs',
	notes: 'For the AI project',
	pileName: 'work',
	subtasks: ['Ask Sam which database we use']
};

const searchResult = {
	type: 'web_search_tool_result',
	tool_use_id: 'srvtoolu_1',
	content: <Block[]>[
		{
			type: 'web_search_result',
			url: 'https://www.youtube.com/watch?v=abc',
			title: 'Graph Databases in 10 Minutes'
		},
		{ type: 'web_search_result', url: 'javascript:alert(1)', title: 'Evil' }
	]
};

type Block = { type: string; [key: string]: unknown };

const reply = (steps: unknown, stop_reason = 'end_turn', extra: Block[] = [searchResult]) => ({
	stop_reason,
	content: <Block[]>[
		{ type: 'thinking', thinking: '' },
		{ type: 'text', text: 'Let me search.' },
		{ type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'graphs' } },
		...extra,
		{ type: 'text', text: typeof steps === 'string' ? steps : JSON.stringify({ steps }) }
	]
});

const step = (text: string, url = '', linkTitle = '') => ({ text, url, linkTitle });

describe('buildBreakdownRequest', () => {
	const request = buildBreakdownRequest(card);

	it('asks Haiku with web search for structured output', () => {
		expect(request.model).toBe('claude-haiku-5-5');
		expect(request.tools).toEqual([
			{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }
		]);
		expect(request.output_config.format.type).toBe('json_schema');
	});

	it('gives Claude the whole card', () => {
		const message = request.messages[0].content;
		expect(message).toContain('Learn more about graphs');
		expect(message).toContain('For the AI project');
		expect(message).toContain('work');
		expect(message).toContain('Ask Sam which database we use');
	});

	it('says links come from search results and existing subtasks are not repeated', () => {
		expect(request.system).toMatch(/search result/i);
		expect(request.system).toMatch(/already/i);
	});
});

describe('interpretBreakdown', () => {
	it("keeps a link found in the search results, using the result's URL and title", () => {
		const steps = interpretBreakdown(
			reply([step('Watch an intro', 'https://youtube.com/watch?v=abc', 'whatever')]),
			[]
		);
		expect(steps).toEqual([
			{
				text: 'Watch an intro',
				url: 'https://www.youtube.com/watch?v=abc',
				linkTitle: 'Graph Databases in 10 Minutes'
			}
		]);
	});

	it('drops a link that was not in the search results but keeps the step', () => {
		expect(
			interpretBreakdown(reply([step('Read the paper', 'https://arxiv.org/made-up', 'x')]), [])
		).toEqual([{ text: 'Read the paper', url: null, linkTitle: null }]);
	});

	it('never matches a search result that is not http(s)', () => {
		expect(interpretBreakdown(reply([step('Click', 'javascript:alert(1)', 'Evil')]), [])).toEqual([
			{ text: 'Click', url: null, linkTitle: null }
		]);
	});

	it('leaves steps without a link alone', () => {
		expect(interpretBreakdown(reply([step('Sketch where it fits')]), [])).toEqual([
			{ text: 'Sketch where it fits', url: null, linkTitle: null }
		]);
	});

	it('ignores a search that errored', () => {
		const failed = { type: 'web_search_tool_result', content: { error_code: 'unavailable' } };
		expect(
			interpretBreakdown(
				reply([step('Watch', 'https://youtube.com/watch?v=abc')], 'end_turn', [failed]),
				[]
			)
		).toEqual([{ text: 'Watch', url: null, linkTitle: null }]);
	});

	it('drops steps that repeat an existing subtask, blanks, and caps and clamps the rest', () => {
		const many = Array.from({ length: 12 }, (_, i) => step(`step ${i}`));
		const steps = interpretBreakdown(
			reply([step(' ask sam WHICH database we use '), step('   '), step('x'.repeat(300)), ...many]),
			['Ask Sam which database we use']
		);
		expect(steps).toHaveLength(MAX_BREAKDOWN_STEPS);
		expect(steps?.[0].text.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
		expect(steps?.[1].text).toBe('step 0');
	});

	it('returns null for a refusal, a cut-off or paused reply, bad JSON, the wrong shape, or no steps', () => {
		const ok = [step('a')];
		expect(interpretBreakdown(reply(ok, 'refusal'), [])).toBeNull();
		expect(interpretBreakdown(reply(ok, 'max_tokens'), [])).toBeNull();
		expect(interpretBreakdown(reply(ok, 'pause_turn'), [])).toBeNull();
		expect(interpretBreakdown(reply('{not json'), [])).toBeNull();
		expect(interpretBreakdown(reply('{"steps":"nope"}'), [])).toBeNull();
		expect(interpretBreakdown(reply([]), [])).toBeNull();
		expect(
			interpretBreakdown(reply([step('Ask Sam which database we use')]), [card.subtasks[0]])
		).toBeNull();
		expect(interpretBreakdown({ stop_reason: 'end_turn', content: [] }, [])).toBeNull();
	});
});

describe('breakdownCard', () => {
	function clientReturning(result: Promise<unknown>) {
		const create = vi.fn().mockReturnValue(result);
		return { client: { messages: { create } } as unknown as Anthropic, create };
	}

	it('returns null without a client', async () => {
		expect(await breakdownCard(null, card)).toBeNull();
	});

	it('returns the steps and passes the 30 s timeout with no retries', async () => {
		const { client, create } = clientReturning(Promise.resolve(reply([step('Sketch it')])));
		expect(await breakdownCard(client, card)).toEqual([
			{ text: 'Sketch it', url: null, linkTitle: null }
		]);
		expect(BREAKDOWN_TIMEOUT_MS).toBe(30_000);
		expect(create.mock.calls[0][1]).toEqual({ timeout: 30_000, maxRetries: 0 });
	});

	it('returns null when Claude fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = clientReturning(Promise.reject(new Error('down')));
		expect(await breakdownCard(client, card)).toBeNull();
	});

	it("keeps exactly one link from the e2e fake's reply", async () => {
		const steps = await breakdownCard(fakeParseClient(), { ...card, subtasks: [] });
		expect(steps?.map((s) => s.url)).toEqual(['https://example.com/graph-intro', null, null]);
		expect(steps?.[0].linkTitle).toBe('Graph Databases in 10 Minutes');
	});

	it("the e2e fake fails on '[fail]'", async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await breakdownCard(fakeParseClient(), { ...card, title: '[fail] graphs' })).toBeNull();
	});
});
