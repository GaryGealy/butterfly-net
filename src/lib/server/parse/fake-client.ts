import type Anthropic from '@anthropic-ai/sdk';

/**
 * A deterministic stand-in for Claude, used only by the e2e suite (dev + FAKE_CLAUDE=1).
 * "[fail]" in the text simulates an outage.
 */
export function fakeParseClient(): Anthropic {
	const create = async (params: { messages: Array<{ content: string }> }) => {
		const text = params.messages[0].content;
		if (text.includes('[fail]')) throw new Error('fake Claude outage');

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
