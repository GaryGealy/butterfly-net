import { describe, expect, it } from 'vitest';
import {
	END_CAPTION,
	SCENES,
	START,
	THOUGHT,
	advance,
	frameAt,
	seek,
	segmentFill,
	stillFrame,
	togglePlay,
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
			['catch', 5_000],
			['sort', 7_000],
			['piles', 8_000]
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

	it('crosses into the next scene, carrying the leftover time', () => {
		expect(advance(at(0, 4_900), 300)).toEqual(at(1, 200));
	});

	it('stops at the end of the last scene', () => {
		expect(advance(at(2, 7_900), 500)).toEqual(at(2, 8_000, { playing: false, ended: true }));
	});

	it('never overshoots the end, however big the step', () => {
		expect(advance(START, 10 * 60_000)).toEqual(at(2, 8_000, { playing: false, ended: true }));
	});

	it('does nothing while paused or after the end', () => {
		const paused = at(1, 4_000, { playing: false });
		expect(advance(paused, 1_000)).toBe(paused);
		const ended = at(2, 8_000, { playing: false, ended: true });
		expect(advance(ended, 1_000)).toBe(ended);
	});
});

describe('seek', () => {
	it('jumps to the start of a scene and keeps playing', () => {
		expect(seek(at(0, 3_000), 2)).toEqual(at(2, 0));
	});

	it('keeps a paused demo paused', () => {
		expect(seek(at(0, 3_000, { playing: false }), 1)).toEqual(at(1, 0, { playing: false }));
	});

	it('plays again when used after the end', () => {
		expect(seek(at(2, 8_000, { playing: false, ended: true }), 0)).toEqual(at(0, 0));
	});

	it('clamps out-of-range scenes', () => {
		expect(seek(START, 9).scene).toBe(2);
		expect(seek(START, -1).scene).toBe(0);
	});
});

describe('togglePlay', () => {
	it('pauses and resumes in place', () => {
		const paused = togglePlay(at(1, 3_000));
		expect(paused).toEqual(at(1, 3_000, { playing: false }));
		expect(togglePlay(paused)).toEqual(at(1, 3_000));
	});

	it('restarts from scene 1 after the end', () => {
		expect(togglePlay(at(2, 8_000, { playing: false, ended: true }))).toEqual(START);
	});
});

describe('segmentFill', () => {
	it('fills past scenes, partly fills the current one and leaves later ones empty', () => {
		const state = at(1, 3_500);
		expect([0, 1, 2].map((i) => segmentFill(state, i))).toEqual([1, 0.5, 0]);
	});

	it('fills everything at the end', () => {
		const state = at(2, 8_000, { playing: false, ended: true });
		expect([0, 1, 2].map((i) => segmentFill(state, i))).toEqual([1, 1, 1]);
	});
});

describe('frameAt', () => {
	it('types the thought in, then sorts', () => {
		expect(frameAt('catch', 0)).toEqual({ scene: 'catch', typed: '', sorting: false });
		expect(frameAt('catch', 400 + 45 * 3)).toEqual({
			scene: 'catch',
			typed: 'fix',
			sorting: false
		});
		expect(frameAt('catch', 3_499)).toEqual({ scene: 'catch', typed: THOUGHT, sorting: false });
		expect(frameAt('catch', 3_500)).toMatchObject({ sorting: true });
	});

	it('presses Save late in the sort scene', () => {
		expect(frameAt('sort', 5_499)).toEqual({ scene: 'sort', saving: false });
		expect(frameAt('sort', 5_500)).toEqual({ scene: 'sort', saving: true });
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
		expect(frameAt('piles', 1_500)).toMatchObject({
			flying: false,
			landed: true,
			lapse: '1 week…'
		});
		expect(frameAt('piles', 3_000)).toMatchObject({ paper: 'cream', lapse: '1 month…' });
		expect(frameAt('piles', 4_500)).toMatchObject({
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
