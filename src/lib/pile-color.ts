/** Each pile wears a pastel by its position in the list; past six, the palette repeats. */
const PILE_COLORS = [
	'bg-pile-sage',
	'bg-pile-sky',
	'bg-pile-butter',
	'bg-pile-lilac',
	'bg-pile-peach',
	'bg-pile-blush'
];

/** A pile Claude proposed but that doesn't exist yet. */
export const NEW_PILE_COLOR = 'bg-pile-blush';
/** No pile chosen yet (Claude couldn't sort it). */
export const NO_PILE_COLOR = 'bg-line';

export function pileColor(index: number): string {
	const n = PILE_COLORS.length;
	return PILE_COLORS[((index % n) + n) % n];
}
