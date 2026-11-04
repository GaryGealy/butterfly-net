// Keeps keyboard focus somewhere sensible when the control that had it disappears
// (a card marked done, a row deleted, a button swapped for another).

import { tick } from 'svelte';

/** Focuses the element with this id once Svelte has updated the DOM. */
export async function focusById(id: string | undefined): Promise<void> {
	if (!id) return;
	await tick();
	document.getElementById(id)?.focus();
}

/**
 * Where focus should go when the list row holding `from` is about to disappear: the control
 * matching `selector` in the next row, else in the previous row, else the `fallback` id.
 */
export function neighbourFocusId(from: Element, selector: string, fallback: string): string {
	const row = from.closest('li');
	const neighbour =
		row?.nextElementSibling?.querySelector(selector) ??
		row?.previousElementSibling?.querySelector(selector);
	return neighbour?.id || fallback;
}
