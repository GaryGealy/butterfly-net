import type { Priority } from './priority';

export interface PileRef {
	id: string;
	name: string;
}

export type ParsedPile =
	{ kind: 'existing'; id: string; name: string } | { kind: 'new'; name: string };

export interface ParseResult {
	title: string;
	pile: ParsedPile | null;
	notes: string | null;
	subtasks: string[];
	priority: Priority;
	/** YYYY-MM-DD, or null when the text named no day. */
	dueOn: string | null;
	source: 'claude' | 'fallback' | 'limit';
}
