// A due date is a calendar day, YYYY-MM-DD, in the user's own calendar. Day arithmetic runs on
// UTC-midnight Dates, so neither the server's nor the browser's time zone can shift a day.

export const TZ_COOKIE = 'tz';

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(day: string): Date {
	const [year, month, date] = day.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, date));
}

function toDay(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/** A real calendar date written YYYY-MM-DD ("2026-02-30" is not). */
export function isIsoDate(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(value) && toDay(toDate(value)) === value;
}

/** `day` moved by `n` days, YYYY-MM-DD. */
export function addDays(day: string, n: number): string {
	return toDay(new Date(toDate(day).getTime() + n * DAY_MS));
}

/** Today's date in `timeZone` (IANA), YYYY-MM-DD; UTC when it's missing or unknown. */
export function localDay(now: Date, timeZone?: string): string {
	try {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone: timeZone || 'UTC',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		}).formatToParts(now);
		const part = (type: string) => parts.find((p) => p.type === type)?.value;
		return `${part('year')}-${part('month')}-${part('day')}`;
	} catch {
		return toDay(now);
	}
}

export type DueTone = 'overdue' | 'today' | 'plain';

export interface DueLabel {
	/** What the board shows: "Overdue", "Today", "Tomorrow", "Fri", "Nov 28", "Jan 4, 2028". */
	text: string;
	tone: DueTone;
	/** The tooltip, with the full date. */
	title: string;
	/** What a screen reader hears after the card title. */
	spoken: string;
}

const format = (day: string, options: Intl.DateTimeFormatOptions) =>
	toDate(day).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });

export function dueLabel(dueOn: string, today: string): DueLabel {
	const days = Math.round((toDate(dueOn).getTime() - toDate(today).getTime()) / DAY_MS);
	const year = dueOn.slice(0, 4) !== today.slice(0, 4) ? ({ year: 'numeric' } as const) : {};
	const short = format(dueOn, { weekday: 'short', month: 'short', day: 'numeric', ...year });
	const long = format(dueOn, { weekday: 'long', month: 'long', day: 'numeric', ...year });

	if (days < 0)
		return {
			text: 'Overdue',
			tone: 'overdue',
			title: `Overdue: was due ${short}`,
			spoken: `overdue, was due ${long}`
		};
	if (days === 0) return { text: 'Today', tone: 'today', title: 'Due today', spoken: 'due today' };
	if (days === 1)
		return { text: 'Tomorrow', tone: 'plain', title: 'Due tomorrow', spoken: 'due tomorrow' };

	const text =
		days <= 6
			? format(dueOn, { weekday: 'short' })
			: days <= 365
				? format(dueOn, { month: 'short', day: 'numeric' })
				: format(dueOn, { month: 'short', day: 'numeric', year: 'numeric' });
	return { text, tone: 'plain', title: `Due ${short}`, spoken: `due ${long}` };
}
