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
	source: 'claude' | 'fallback';
}
