import { z } from 'zod';

/** JSON Schema sent to Claude as the structured-output format. */
export const BREAKDOWN_JSON_SCHEMA: Record<string, unknown> = {
	type: 'object',
	properties: {
		steps: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					text: { type: 'string', description: 'A short, concrete action' },
					url: {
						type: 'string',
						description: 'A URL copied exactly from a web search result, or an empty string'
					},
					linkTitle: {
						type: 'string',
						description: "That search result's title, or an empty string"
					}
				},
				required: ['text', 'url', 'linkTitle'],
				additionalProperties: false
			}
		}
	},
	required: ['steps'],
	additionalProperties: false
};

/** Runtime check of what came back. */
export const breakdownReplySchema = z.object({
	steps: z.array(
		z.object({
			text: z.string(),
			url: z.string(),
			linkTitle: z.string()
		})
	)
});
