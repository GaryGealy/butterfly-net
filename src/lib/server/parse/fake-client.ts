import type Anthropic from '@anthropic-ai/sdk';
import { addDays, weekdayName } from '../../due';

/**
 * A deterministic stand-in for Claude, used only by the e2e suite (dev + FAKE_CLAUDE=1).
 * "[fail]" in the text simulates an outage.
 */
export function fakeParseClient(): Anthropic {
	const create = async (params: {
		system?: string;
		messages: Array<{ content: string }>;
		tools?: unknown[];
	}) => {
		const text = params.messages[0].content;
		if (text.includes('[fail]')) throw new Error('fake Claude outage');
		if (params.tools) return fakeBreakdown();

		const lower = text.toLowerCase();
		const pile = /model|kit|paint/.test(lower)
			? 'model building'
			: /game/.test(lower)
				? 'video games'
				: 'garden';
		const priority = /\burgent\b/.test(lower)
			? 'high'
			: /\bwhenever\b/.test(lower)
				? 'low'
				: 'medium';
		const today = params.system?.match(/Today is \w+, (\d{4}-\d{2}-\d{2})/)?.[1];
		let dueDate = '';
		if (today && /\btomorrow\b/.test(lower)) dueDate = addDays(today, 1);
		if (today && /\bby friday\b/.test(lower)) {
			dueDate = today;
			while (weekdayName(dueDate) !== 'Friday') dueDate = addDays(dueDate, 1);
		}
		const body = {
			title: text.replace(/\b(urgent|whenever|tomorrow|by friday)\b[:,]?\s*/gi, '').trim(),
			pile,
			isNewPile: pile === 'garden',
			notes: '',
			subtasks: [],
			priority,
			dueDate
		};
		return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(body) }] };
	};
	return { messages: { create } } as unknown as Anthropic;
}

/**
 * Break it down's reply: one search result, and three steps. The first links to that result,
 * the second to a URL the search never returned (which must be dropped), the third has no link.
 */
function fakeBreakdown() {
	const steps = [
		{
			text: 'Watch an intro to graph databases',
			url: 'https://example.com/graph-intro',
			linkTitle: 'Graph Databases in 10 Minutes'
		},
		{
			text: 'Read the GraphRAG paper',
			url: 'https://example.com/invented',
			linkTitle: 'GraphRAG'
		},
		{ text: 'Sketch where a graph fits', url: '', linkTitle: '' }
	];
	return {
		stop_reason: 'end_turn',
		content: [
			{
				type: 'server_tool_use',
				id: 'srvtoolu_fake',
				name: 'web_search',
				input: { query: 'graphs' }
			},
			{
				type: 'web_search_tool_result',
				tool_use_id: 'srvtoolu_fake',
				content: [
					{
						type: 'web_search_result',
						url: 'https://example.com/graph-intro',
						title: 'Graph Databases in 10 Minutes'
					}
				]
			},
			{ type: 'text', text: JSON.stringify({ steps }) }
		]
	};
}
