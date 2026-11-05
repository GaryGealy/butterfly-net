/** The invite intro's script: three scenes, how time moves through them, and what each shows. */

export type SceneId = 'catch' | 'sort' | 'piles';

export interface Scene {
	id: SceneId;
	title: string;
	caption: string;
	/** In milliseconds. */
	duration: number;
}

export const SCENES: readonly Scene[] = [
	{
		id: 'catch',
		title: 'Catch a thought',
		caption: 'A thought pops up? Catch it before it flutters off, from your Mac or your phone.',
		duration: 3_500
	},
	{
		id: 'sort',
		title: 'AI sorts it',
		caption: 'AI suggests a pile. Change anything you like, then save.',
		duration: 4_900
	},
	{
		id: 'piles',
		title: 'Piles and ageing',
		caption: 'Cards wait on their piles. Leave one too long and it yellows like old paper.',
		duration: 5_600
	}
];

export const END_CAPTION = "Catch it, let AI sort it, come back when you're ready.";

/** What gets typed in scene 1, and the title the AI tidies it to. */
export const THOUGHT = 'fix the squeaky hinge on the back door';
export const TIDY_TITLE = 'Fix the squeaky hinge on the back door';

export interface PlayState {
	scene: number;
	/** Milliseconds into the current scene. */
	elapsed: number;
	playing: boolean;
	ended: boolean;
}

export const START: PlayState = { scene: 0, elapsed: 0, playing: true, ended: false };

/** Plays the current scene on; at its end the demo waits for Next, or ends after the last. */
export function advance(state: PlayState, ms: number, scenes = SCENES): PlayState {
	if (!state.playing || state.ended || ms <= 0) return state;
	const { duration } = scenes[state.scene];
	const elapsed = state.elapsed + ms;
	if (elapsed < duration) return { ...state, elapsed };
	return { ...state, elapsed: duration, playing: false, ended: state.scene === scenes.length - 1 };
}

/** True when a scene has played through and the demo is waiting for Next. */
export function waiting(state: PlayState, scenes = SCENES): boolean {
	return !state.ended && state.elapsed >= scenes[state.scene].duration;
}

/** Plays the following scene from its start; after the end, starts again from scene 1. */
export function next(state: PlayState, scenes = SCENES): PlayState {
	if (state.ended || state.scene === scenes.length - 1) return START;
	return { scene: state.scene + 1, elapsed: 0, playing: true, ended: false };
}

/** Plays a picked scene from its start. */
export function seek(index: number, scenes = SCENES): PlayState {
	const scene = Math.min(Math.max(index, 0), scenes.length - 1);
	return { scene, elapsed: 0, playing: true, ended: false };
}

/** How full scene `index`'s progress segment is, from 0 to 1. */
export function segmentFill(state: PlayState, index: number, scenes = SCENES): number {
	if (state.ended || index < state.scene) return 1;
	if (index > state.scene) return 0;
	return state.elapsed / scenes[index].duration;
}

export type Paper = 'fresh' | 'cream' | 'yellow';

export type Frame =
	| { scene: 'catch'; typed: string; sorting: boolean }
	| { scene: 'sort'; saving: boolean }
	| {
			scene: 'piles';
			flying: boolean;
			landed: boolean;
			paper: Paper;
			lapse: string | null;
			age: string | null;
	  };

const TYPE_START = 280;
const TYPE_STEP = 32;
const SORTING_AT = 2_450;
const SAVE_AT = 3_850;
const LAND_AT = 1_050;
const CREAM_AT = 2_100;
const YELLOW_AT = 3_150;

/** What scene `id` shows `elapsed` milliseconds in. */
export function frameAt(id: SceneId, elapsed: number): Frame {
	switch (id) {
		case 'catch': {
			const chars = Math.max(0, Math.floor((elapsed - TYPE_START) / TYPE_STEP));
			return { scene: 'catch', typed: THOUGHT.slice(0, chars), sorting: elapsed >= SORTING_AT };
		}
		case 'sort':
			return { scene: 'sort', saving: elapsed >= SAVE_AT };
		case 'piles': {
			const landed = elapsed >= LAND_AT;
			return {
				scene: 'piles',
				flying: !landed,
				landed,
				paper: elapsed >= YELLOW_AT ? 'yellow' : elapsed >= CREAM_AT ? 'cream' : 'fresh',
				lapse: !landed
					? null
					: elapsed < CREAM_AT
						? '1 week…'
						: elapsed < YELLOW_AT
							? '1 month…'
							: '4 months',
				age: elapsed >= YELLOW_AT ? '4mo' : null
			};
		}
	}
}

/** Each scene settled, with nothing mid-motion, for people who prefer reduced motion. */
export function stillFrame(id: SceneId): Frame {
	switch (id) {
		case 'catch':
			return frameAt('catch', SORTING_AT - 1);
		case 'sort':
			return frameAt('sort', SAVE_AT - 1);
		case 'piles': {
			const settled = frameAt('piles', YELLOW_AT);
			return settled.scene === 'piles' ? { ...settled, lapse: null } : settled;
		}
	}
}
