import type Anthropic from '@anthropic-ai/sdk';

/**
 * A deterministic stand-in for Claude, used only by the e2e suite (dev + FAKE_CLAUDE=1).
 * "[fail]" in the text simulates an outage.
 */
export function fakeParseClient(): Anthropic {
	const create = async (params: { messages: Array<{ content: string }>; tools?: unknown[] }) => {
		const text = params.messages[0].content;
		if (text.includes('[fail]')) throw new Error('fake Claude outage');
		if (params.tools) return fakeBreakdown();

		const lower = text.toLowerCase();
		const pile = /model|kit|paint/.test(lower)
			? 'model building'
			: /game/.test(lower)
				? 'video games'
				: 'garden';
		const body = {
			title: text.trim(),
			pile,
			isNewPile: pile === 'garden',
			notes: '',
			subtasks: []
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
