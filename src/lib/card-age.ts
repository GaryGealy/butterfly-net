// How long a card has sat on its pile, counted from when it was caught. Cards yellow
// like paper as they age so the neglected ones stand out.

export type AgeStage = 'fresh' | 'cream' | 'yellow' | 'deep';

export interface CardAge {
	stage: AgeStage;
	/** Short label ("5w", "3mo", "1y") once a card is 4 weeks old, otherwise null. */
	label: string | null;
	/** "today", "yesterday", "3 days ago", "5 weeks ago", … */
	phrase: string;
}

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const CREAM_AT = WEEK;
const YELLOW_AT = 4 * WEEK;
const DEEP_AT = 90 * DAY;

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;

export function cardAge(createdAt: Date, now: Date): CardAge {
	const age = Math.max(0, now.getTime() - createdAt.getTime());

	const stage: AgeStage =
		age >= DEEP_AT ? 'deep' : age >= YELLOW_AT ? 'yellow' : age >= CREAM_AT ? 'cream' : 'fresh';

	const label =
		age >= YEAR
			? `${Math.floor(age / YEAR)}y`
			: age >= DEEP_AT
				? `${Math.floor(age / MONTH)}mo`
				: age >= YELLOW_AT
					? `${Math.floor(age / WEEK)}w`
					: null;

	const phrase =
		age >= YEAR
			? plural(Math.floor(age / YEAR), 'year')
			: age >= DEEP_AT
				? plural(Math.floor(age / MONTH), 'month')
				: age >= WEEK
					? plural(Math.floor(age / WEEK), 'week')
					: age >= 2 * DAY
						? plural(Math.floor(age / DAY), 'day')
						: age >= DAY
							? 'yesterday'
							: 'today';

	return { stage, label, phrase };
}
