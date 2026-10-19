import { z } from 'zod';
import { MAX_NOTES_LENGTH, MAX_PILE_NAME_LENGTH, MAX_TITLE_LENGTH } from './parse/parse';

export const MAX_SUBTASKS = 50;

export const credentialsSchema = z.object({
	email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
	password: z
		.string()
		.min(8, 'Password must be at least 8 characters')
		.max(200, 'Password is too long')
});

export const titleSchema = z
	.string()
	.trim()
	.min(1, 'Title is required')
	.max(MAX_TITLE_LENGTH, `Title must be ${MAX_TITLE_LENGTH} characters or fewer`);

export const notesSchema = z
	.string()
	.trim()
	.max(MAX_NOTES_LENGTH, `Notes must be ${MAX_NOTES_LENGTH} characters or fewer`)
	.nullish()
	.transform((value) => (value ? value : null));

export const subtasksSchema = z
	.array(z.string())
	.max(MAX_SUBTASKS, `A card can have at most ${MAX_SUBTASKS} subtasks`)
	.transform((items) => items.map((item) => item.trim()).filter((item) => item.length > 0))
	.pipe(z.array(z.string().max(MAX_TITLE_LENGTH, 'Subtasks must be 200 characters or fewer')));

export const pileNameSchema = z
	.string()
	.trim()
	.min(1, 'Pile name is required')
	.max(MAX_PILE_NAME_LENGTH, `Pile names must be ${MAX_PILE_NAME_LENGTH} characters or fewer`);

export const captureSaveSchema = z.object({
	title: titleSchema,
	notes: notesSchema,
	subtasks: subtasksSchema,
	pile: z.discriminatedUnion('kind', [
		z.object({ kind: z.literal('existing'), id: z.string().min(1) }),
		z.object({ kind: z.literal('new'), name: pileNameSchema })
	])
});

export type CaptureSave = z.infer<typeof captureSaveSchema>;

export const cardEditSchema = z.object({
	title: titleSchema,
	notes: notesSchema,
	pileId: z.string().min(1, 'Choose a pile')
});
