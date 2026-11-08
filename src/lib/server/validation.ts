import { z } from 'zod';
import type { SubtaskInput } from './cards';
import { httpUrl } from './links';
import {
	MAX_EMAIL_LENGTH,
	MAX_NOTES_LENGTH,
	MAX_PASSWORD_LENGTH,
	MAX_PILE_NAME_LENGTH,
	MAX_SUBTASKS,
	MAX_TITLE_LENGTH
} from '../limits';

export const credentialsSchema = z.object({
	email: z
		.string()
		.trim()
		.toLowerCase()
		.max(MAX_EMAIL_LENGTH, `Email must be ${MAX_EMAIL_LENGTH} characters or fewer`)
		.pipe(z.email('Enter a valid email address')),
	password: z
		.string()
		.min(8, 'Password must be at least 8 characters')
		.max(MAX_PASSWORD_LENGTH, 'Password is too long')
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
	.pipe(
		z.array(
			z.string().max(MAX_TITLE_LENGTH, `Subtasks must be ${MAX_TITLE_LENGTH} characters or fewer`)
		)
	);

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

/**
 * The card page's subtask rows, posted as parallel fields (`subtask_text`, `subtask_url`,
 * `subtask_link_title`) plus `subtask_done` holding the indexes of ticked rows. Blank rows are
 * dropped, and a link that isn't http(s) is dropped along with its title.
 */
export function subtaskRowsFromForm(form: FormData): SubtaskInput[] {
	const doneRows = new Set(form.getAll('subtask_done').map(String));
	const urls = form.getAll('subtask_url');
	const titles = form.getAll('subtask_link_title');
	return form
		.getAll('subtask_text')
		.map((value, i) => {
			const url = httpUrl(urls[i]);
			const linkTitle = url
				? String(titles[i] ?? '')
						.trim()
						.slice(0, MAX_TITLE_LENGTH)
				: '';
			return {
				text: String(value).trim().slice(0, MAX_TITLE_LENGTH),
				done: doneRows.has(String(i)),
				url,
				linkTitle: linkTitle || null
			};
		})
		.filter((item) => item.text.length > 0)
		.slice(0, MAX_SUBTASKS);
}
