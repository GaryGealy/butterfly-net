import { describe, expect, it } from 'vitest';
import { MAX_EMAIL_LENGTH, MAX_NOTES_LENGTH } from '../limits';
import { captureSaveSchema, credentialsSchema, subtasksSchema } from './validation';

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
