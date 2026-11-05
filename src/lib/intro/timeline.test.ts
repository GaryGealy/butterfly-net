import { describe, expect, it } from 'vitest';
import {
	END_CAPTION,
	SCENES,
	START,
	THOUGHT,
	advance,
	frameAt,
	next,
	seek,
	segmentFill,
	stillFrame,
	waiting,
	type PlayState
} from './timeline';

const at = (scene: number, elapsed: number, extra: Partial<PlayState> = {}): PlayState => ({
	scene,
	elapsed,
	playing: true,
	ended: false,
	...extra
});

describe('the script', () => {
	it('has three scenes in order with their durations and captions', () => {
		expect(SCENES.map((s) => [s.id, s.duration])).toEqual([
			['catch', 3_500],
			['sort', 4_900],
			['piles', 5_600]
		]);
		expect(SCENES[0].caption).toBe(
			'A thought pops up? Catch it before it flutters off, from your Mac or your phone.'
		);
		expect(END_CAPTION).toBe("Catch it, let AI sort it, come back when you're ready.");
		expect(SCENES[1].title).toBe('AI sorts it');
		expect(SCENES.some((s) => /Claude/.test(s.title + s.caption))).toBe(false);
		expect(START).toEqual(at(0, 0));
	});
});

describe('advance', () => {
	it('moves time forward within a scene', () => {
		expect(advance(at(0, 1_000), 500)).toEqual(at(0, 1_500));
	});

	it('stops at the end of a scene and waits there for Next', () => {
		const rested = advance(at(0, 3_400), 300);
		expect(rested).toEqual(at(0, 3_500, { playing: false }));
		expect(waiting(rested)).toBe(true);
	});

	it('ends the demo at the end of the last scene', () => {
		const end = advance(at(2, 5_500), 500);
		expect(end).toEqual(at(2, 5_600, { playing: false, ended: true }));
		expect(waiting(end)).toBe(false);
	});

	it('never runs past the scene it is in, however big the step', () => {
		expect(advance(START, 10 * 60_000)).toEqual(at(0, 3_500, { playing: false }));
	});

	it('does nothing while paused, waiting or after the end', () => {
		const paused = at(1, 4_000, { playing: false });
		expect(advance(paused, 1_000)).toBe(paused);
		expect(waiting(paused)).toBe(false);
		const rested = at(1, 4_900, { playing: false });
		expect(advance(rested, 1_000)).toBe(rested);
		const ended = at(2, 5_600, { playing: false, ended: true });
		expect(advance(ended, 1_000)).toBe(ended);
	});
});

describe('next', () => {
	it('plays the following scene from its start', () => {
		expect(next(at(0, 3_500, { playing: false }))).toEqual(at(1, 0));
	});

	it('skips ahead mid-scene too', () => {
		expect(next(at(1, 2_000))).toEqual(at(2, 0));
	});

	it('starts again from scene 1 after the end', () => {
		expect(next(at(2, 5_600, { playing: false, ended: true }))).toEqual(START);
	});
});

describe('seek', () => {
	it('plays a picked scene from its start', () => {
		expect(seek(2)).toEqual(at(2, 0));
		expect(seek(0)).toEqual(START);
	});

	it('clamps out-of-range scenes', () => {
		expect(seek(9).scene).toBe(2);
		expect(seek(-1).scene).toBe(0);
	});
});

describe('segmentFill', () => {
	it('fills past scenes, partly fills the current one and leaves later ones empty', () => {
		const state = at(1, 2_450);
		expect([0, 1, 2].map((i) => segmentFill(state, i))).toEqual([1, 0.5, 0]);
	});

	it('fills a waiting scene', () => {
		const state = at(1, 4_900, { playing: false });
		expect([0, 1, 2].map((i) => segmentFill(state, i))).toEqual([1, 1, 0]);
	});

	it('fills everything at the end', () => {
		const state = at(2, 5_600, { playing: false, ended: true });
		expect([0, 1, 2].map((i) => segmentFill(state, i))).toEqual([1, 1, 1]);
	});
});

describe('frameAt', () => {
	it('types the thought in, then sorts', () => {
		expect(frameAt('catch', 0)).toEqual({ scene: 'catch', typed: '', sorting: false });
		expect(frameAt('catch', 280 + 32 * 3)).toEqual({
			scene: 'catch',
			typed: 'fix',
			sorting: false
		});
		expect(frameAt('catch', 2_449)).toEqual({ scene: 'catch', typed: THOUGHT, sorting: false });
		expect(frameAt('catch', 2_450)).toMatchObject({ sorting: true });
	});

	it('presses Save late in the sort scene', () => {
		expect(frameAt('sort', 3_849)).toEqual({ scene: 'sort', saving: false });
		expect(frameAt('sort', 3_850)).toEqual({ scene: 'sort', saving: true });
	});

	it('flies the butterfly, lands the card, then ages it', () => {
		expect(frameAt('piles', 0)).toEqual({
			scene: 'piles',
			flying: true,
			landed: false,
			paper: 'fresh',
			lapse: null,
			age: null
		});
		expect(frameAt('piles', 1_050)).toMatchObject({
			flying: false,
			landed: true,
			lapse: '1 week…'
		});
		expect(frameAt('piles', 2_100)).toMatchObject({ paper: 'cream', lapse: '1 month…' });
		expect(frameAt('piles', 3_150)).toMatchObject({
			paper: 'yellow',
			lapse: '4 months',
			age: '4mo'
		});
	});
});

describe('stillFrame', () => {
	it('shows each scene settled, for reduced motion', () => {
		expect(stillFrame('catch')).toEqual({ scene: 'catch', typed: THOUGHT, sorting: false });
		expect(stillFrame('sort')).toEqual({ scene: 'sort', saving: false });
		expect(stillFrame('piles')).toEqual({
			scene: 'piles',
			flying: false,
			landed: true,
			paper: 'yellow',
			lapse: null,
			age: '4mo'
		});
	});
});
