import { z } from 'zod';

/** JSON Schema sent to Claude as the structured-output format. */
export const PARSE_JSON_SCHEMA: Record<string, unknown> = {
	type: 'object',
	properties: {
		title: { type: 'string', description: "A short, clear to-do in the user's own words" },
		pile: {
			type: 'string',
			description: 'The exact name of an existing pile, or a proposed new pile name'
		},
		isNewPile: { type: 'boolean', description: 'True only when proposing a new pile' },
		notes: { type: 'string', description: 'Extra detail from the text, or an empty string' },
		subtasks: {
			type: 'array',
			items: { type: 'string' },
			description: 'Steps or items the text explicitly lists, otherwise empty'
		}
	},
	required: ['title', 'pile', 'isNewPile', 'notes', 'subtasks'],
	additionalProperties: false
};

/** Runtime check of what came back, since a fallback model or bug could still send junk. */
export const parsedCardSchema = z.object({
	title: z.string(),
	pile: z.string(),
	isNewPile: z.boolean(),
	notes: z.string(),
	subtasks: z.array(z.string())
});
