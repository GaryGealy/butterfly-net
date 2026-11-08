/** Whether two step texts say the same thing, ignoring case and spacing. */
export function sameStepText(a: string, b: string): boolean {
	const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
	return norm(a) === norm(b);
}
