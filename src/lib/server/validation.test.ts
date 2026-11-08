import { describe, expect, it } from 'vitest';
import { MAX_EMAIL_LENGTH, MAX_NOTES_LENGTH } from '../limits';
import {
	captureSaveSchema,
	credentialsSchema,
	subtaskRowsFromForm,
	subtasksSchema
} from './validation';

describe('credentialsSchema', () => {
	it('normalizes email and requires 8+ character passwords', () => {
		expect(credentialsSchema.parse({ email: ' Me@Example.com ', password: '12345678' })).toEqual({
			email: 'me@example.com',
			password: '12345678'
		});
		expect(credentialsSchema.safeParse({ email: 'nope', password: '12345678' }).success).toBe(
			false
		);
		expect(
			credentialsSchema.safeParse({ email: 'me@example.com', password: 'short' }).success
		).toBe(false);
	});

	it('rejects emails longer than 254 characters', () => {
		const email = (length: number) => `${'a'.repeat(length - '@example.com'.length)}@example.com`;
		expect(MAX_EMAIL_LENGTH).toBe(254);
		expect(credentialsSchema.safeParse({ email: email(254), password: '12345678' }).success).toBe(
			true
		);
		const tooLong = credentialsSchema.safeParse({ email: email(255), password: '12345678' });
		expect(tooLong.error?.issues[0].message).toBe('Email must be 254 characters or fewer');
	});
});

describe('subtasksSchema', () => {
	it('trims and drops blank items', () => {
		expect(subtasksSchema.parse([' a ', '', '  ', 'b'])).toEqual(['a', 'b']);
	});

	it('rejects more than 50 items', () => {
		expect(subtasksSchema.safeParse(Array.from({ length: 51 }, () => 'x')).success).toBe(false);
	});
});

describe('captureSaveSchema', () => {
	const base = { title: ' Paint the X-wing ', notes: '', subtasks: [] };

	it('accepts an existing or a new pile and normalizes empty notes to null', () => {
		expect(captureSaveSchema.parse({ ...base, pile: { kind: 'existing', id: 'p1' } })).toEqual({
			title: 'Paint the X-wing',
			notes: null,
			subtasks: [],
			pile: { kind: 'existing', id: 'p1' }
		});
		expect(
			captureSaveSchema.parse({ ...base, pile: { kind: 'new', name: ' garden ' } }).pile
		).toEqual({ kind: 'new', name: 'garden' });
	});

	it('rejects an empty title, a missing pile, and over-long fields', () => {
		expect(
			captureSaveSchema.safeParse({ ...base, title: '  ', pile: { kind: 'existing', id: 'p1' } })
				.success
		).toBe(false);
		expect(captureSaveSchema.safeParse(base).success).toBe(false);
		expect(
			captureSaveSchema.safeParse({
				...base,
				title: 'x'.repeat(201),
				pile: { kind: 'existing', id: 'p1' }
			}).success
		).toBe(false);
		expect(
			captureSaveSchema.safeParse({ ...base, pile: { kind: 'new', name: 'x'.repeat(41) } }).success
		).toBe(false);
	});

	it('caps notes at 1000 characters', () => {
		const pile = { kind: 'existing', id: 'p1' } as const;
		expect(MAX_NOTES_LENGTH).toBe(1000);
		expect(captureSaveSchema.safeParse({ ...base, notes: 'x'.repeat(1000), pile }).success).toBe(
			true
		);
		const tooLong = captureSaveSchema.safeParse({ ...base, notes: 'x'.repeat(1001), pile });
		expect(tooLong.error?.issues[0].message).toBe('Notes must be 1000 characters or fewer');
	});
});

describe('subtaskRowsFromForm', () => {
	const form = (rows: Array<[string, string, string, boolean]>) => {
		const data = new FormData();
		rows.forEach(([text, url, linkTitle, done], i) => {
			data.append('subtask_text', text);
			data.append('subtask_url', url);
			data.append('subtask_link_title', linkTitle);
			if (done) data.append('subtask_done', String(i));
		});
		return data;
	};

	it('keeps each row with its link and done flag', () => {
		expect(
			subtaskRowsFromForm(
				form([
					['Watch', 'https://x.dev/v', 'A video', false],
					['Sketch', '', '', true]
				])
			)
		).toEqual([
			{ text: 'Watch', done: false, url: 'https://x.dev/v', linkTitle: 'A video' },
			{ text: 'Sketch', done: true, url: null, linkTitle: null }
		]);
	});

	it('drops a link that is not http(s), along with its title', () => {
		expect(subtaskRowsFromForm(form([['Watch', 'javascript:alert(1)', 'x', false]]))).toEqual([
			{ text: 'Watch', done: false, url: null, linkTitle: null }
		]);
	});

	it('drops blank rows but keeps the done flags lined up', () => {
		expect(
			subtaskRowsFromForm(
				form([
					['  ', '', '', false],
					['Second', '', '', true]
				])
			)
		).toEqual([{ text: 'Second', done: true, url: null, linkTitle: null }]);
	});

	it('works for rows posted without link fields', () => {
		const data = new FormData();
		data.append('subtask_text', 'Old form');
		expect(subtaskRowsFromForm(data)).toEqual([
			{ text: 'Old form', done: false, url: null, linkTitle: null }
		]);
	});
});
