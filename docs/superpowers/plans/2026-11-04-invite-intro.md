# Invite Intro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invite links open `/welcome`, a skippable ~35-second animated "Here's Butterfly Net" demo that leads to the existing sign-up form.

**Architecture:** A pure TypeScript script module (`src/lib/intro/timeline.ts`) owns the scenes, timing and what each scene shows at a moment; `IntroDemo.svelte` renders those frames with the app's own classes, drives time with `requestAnimationFrame`, and swaps to still frames under reduced motion. A new public `/welcome` route validates the invite and hosts the demo; both invite-link builders switch to it. `/signup` is unchanged.

**Tech Stack:** SvelteKit 3, Svelte 5 runes (`$state.raw`, `$derived`, `prefersReducedMotion` from `svelte/motion`), Tailwind 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-04-invite-intro-design.md`

## Global Constraints

- No new dependencies; no images, video or audio. Svelte and CSS only.
- Nothing is stored: no "watched" flag, no table, column or migration.
- `/signup` stays as it is; `/signup?invite=…` links already sent keep working.
- Meadow rules (DESIGN.md): ease-out, no bounce or spring, no sparkle or glow on Claude; the butterfly drift into scene 3 is the one decorative moment.
- Copy, verbatim:
  - h1 "Here's Butterfly Net"; title "Welcome · Butterfly Net"; links "Skip to sign-up", "Create my account", "Watch again".
  - Scene 1 "Catch a thought": "A thought pops up? Catch it before it flutters off, from your Mac or your phone."
  - Scene 2 "Claude sorts it": "Claude suggests a pile. Change anything you like, then save."
  - Scene 3 "Piles and ageing": "Cards wait on their piles. Leave one too long and it yellows like old paper."
  - End: "Catch it, let Claude sort it, come back when you're ready."
- Scene durations: 10 000 ms, 12 000 ms, 13 000 ms.
- Every control is a real button or link with a 44px target and the leaf focus ring; nothing inside the animated picture takes focus.
- No sideways scroll at 320px with 200% text.
- Links with a query string use `resolve(`/signup?invite=${encodeURIComponent(code)}`)` (the `svelte/no-navigation-without-resolve` lint rule rejects anything else; this form passes lint and type checks).
- Commits are conventional with no `Co-Authored-By` or "Generated with Claude Code" lines.

## Review Focus

1. A signed-out invitee opening `/welcome?invite=…` must see the intro, not be bounced to `/login` (`isPublicPath` must include `/welcome`). → Task 3 unit + e2e.
2. Odd characters in a code (`&`, `+`, spaces) must survive the trip to `/signup` and land on the "Invite only" message, not a broken or different query. → Task 3 e2e "a bogus code with odd characters…".
3. A backgrounded tab must pause the demo and resume where it was, not jump scenes when it returns. → Task 1 unit (large `advance` never overshoots the end) + Task 3 e2e "hiding the tab pauses…".
4. Reduced-motion visitors must still be able to see all three scenes without anything playing. → Task 3 e2e "with reduced motion…".
5. A 320px phone at 200% text must show the whole demo with no sideways scroll. → Task 3 e2e "…200% text…".

---

### Task 1: The intro script (`timeline.ts`)

**Files:**
- Create: `src/lib/intro/timeline.ts`
- Test: `src/lib/intro/timeline.test.ts`

**Interfaces:**
- Produces (used by Task 2):
  - `type SceneId = 'catch' | 'sort' | 'piles'`
  - `interface Scene { id: SceneId; title: string; caption: string; duration: number }`
  - `const SCENES: readonly Scene[]`, `const END_CAPTION: string`, `const THOUGHT: string`, `const TIDY_TITLE: string`
  - `interface PlayState { scene: number; elapsed: number; playing: boolean; ended: boolean }`, `const START: PlayState`
  - `advance(state: PlayState, ms: number, scenes?: readonly Scene[]): PlayState`
  - `seek(state: PlayState, index: number, scenes?: readonly Scene[]): PlayState`
  - `togglePlay(state: PlayState): PlayState`
  - `segmentFill(state: PlayState, index: number, scenes?: readonly Scene[]): number`
  - `type Paper = 'fresh' | 'cream' | 'yellow'`
  - `type Frame = { scene: 'catch'; typed: string; sorting: boolean } | { scene: 'sort'; saving: boolean } | { scene: 'piles'; flying: boolean; landed: boolean; paper: Paper; lapse: string | null; age: string | null }`
  - `frameAt(id: SceneId, elapsed: number): Frame`, `stillFrame(id: SceneId): Frame`

Ruling: the spec describes "a `createTimeline(scenes)` state machine exposing play/pause/seek/tick/restart". This plan implements the same operations as pure functions over an immutable `PlayState` (`advance` = tick, `togglePlay` = play/pause/restart, `seek`), because Svelte 5 reactivity works directly on a `$state.raw` value that is replaced each frame. Behaviour is identical; cost if wrong: a rename.

- [ ] **Step 1: Write the failing tests**

`src/lib/intro/timeline.test.ts`:

```ts
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
			['catch', 10_000],
			['sort', 12_000],
			['piles', 13_000]
		]);
		expect(SCENES[0].caption).toBe(
			'A thought pops up? Catch it before it flutters off, from your Mac or your phone.'
		);
		expect(END_CAPTION).toBe("Catch it, let Claude sort it, come back when you're ready.");
		expect(START).toEqual(at(0, 0));
	});
});

describe('advance', () => {
	it('moves time forward within a scene', () => {
		expect(advance(at(0, 1_000), 500)).toEqual(at(0, 1_500));
	});

	it('crosses into the next scene, carrying the leftover time', () => {
		expect(advance(at(0, 9_900), 300)).toEqual(at(1, 200));
	});

	it('stops at the end of the last scene', () => {
		expect(advance(at(2, 12_900), 500)).toEqual(at(2, 13_000, { playing: false, ended: true }));
	});

	it('never overshoots the end, however big the step', () => {
		expect(advance(START, 10 * 60_000)).toEqual(at(2, 13_000, { playing: false, ended: true }));
	});

	it('does nothing while paused or after the end', () => {
		const paused = at(1, 4_000, { playing: false });
		expect(advance(paused, 1_000)).toBe(paused);
		const ended = at(2, 13_000, { playing: false, ended: true });
		expect(advance(ended, 1_000)).toBe(ended);
	});
});

describe('seek', () => {
	it('jumps to the start of a scene and keeps playing', () => {
		expect(seek(at(0, 5_000), 2)).toEqual(at(2, 0));
	});

	it('keeps a paused demo paused', () => {
		expect(seek(at(0, 5_000, { playing: false }), 1)).toEqual(at(1, 0, { playing: false }));
	});

	it('plays again when used after the end', () => {
		expect(seek(at(2, 13_000, { playing: false, ended: true }), 0)).toEqual(at(0, 0));
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
		expect(togglePlay(at(2, 13_000, { playing: false, ended: true }))).toEqual(START);
	});
});

describe('segmentFill', () => {
	it('fills past scenes, partly fills the current one and leaves later ones empty', () => {
		const state = at(1, 6_000);
		expect([0, 1, 2].map((i) => segmentFill(state, i))).toEqual([1, 0.5, 0]);
	});

	it('fills everything at the end', () => {
		const state = at(2, 13_000, { playing: false, ended: true });
		expect([0, 1, 2].map((i) => segmentFill(state, i))).toEqual([1, 1, 1]);
	});
});

describe('frameAt', () => {
	it('types the thought in, then sorts', () => {
		expect(frameAt('catch', 0)).toEqual({ scene: 'catch', typed: '', sorting: false });
		expect(frameAt('catch', 800 + 55 * 3)).toEqual({ scene: 'catch', typed: 'fix', sorting: false });
		expect(frameAt('catch', 6_499)).toEqual({ scene: 'catch', typed: THOUGHT, sorting: false });
		expect(frameAt('catch', 6_500).sorting).toBe(true);
	});

	it('presses Save late in the sort scene', () => {
		expect(frameAt('sort', 8_999)).toEqual({ scene: 'sort', saving: false });
		expect(frameAt('sort', 9_000)).toEqual({ scene: 'sort', saving: true });
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
		expect(frameAt('piles', 2_000)).toMatchObject({ flying: false, landed: true, lapse: '1 week…' });
		expect(frameAt('piles', 5_000)).toMatchObject({ paper: 'cream', lapse: '1 month…' });
		expect(frameAt('piles', 8_000)).toMatchObject({ paper: 'yellow', lapse: '4 months', age: '4mo' });
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest --run src/lib/intro/timeline.test.ts`
Expected: FAIL, "Failed to resolve import ./timeline".

- [ ] **Step 3: Write the implementation**

`src/lib/intro/timeline.ts`:

```ts
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
		duration: 10_000
	},
	{
		id: 'sort',
		title: 'Claude sorts it',
		caption: 'Claude suggests a pile. Change anything you like, then save.',
		duration: 12_000
	},
	{
		id: 'piles',
		title: 'Piles and ageing',
		caption: 'Cards wait on their piles. Leave one too long and it yellows like old paper.',
		duration: 13_000
	}
];

export const END_CAPTION = "Catch it, let Claude sort it, come back when you're ready.";

/** What gets typed in scene 1, and the title Claude tidies it to. */
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

export function advance(state: PlayState, ms: number, scenes = SCENES): PlayState {
	if (!state.playing || state.ended || ms <= 0) return state;
	let { scene, elapsed } = state;
	elapsed += ms;
	while (elapsed >= scenes[scene].duration) {
		if (scene === scenes.length - 1) {
			return { scene, elapsed: scenes[scene].duration, playing: false, ended: true };
		}
		elapsed -= scenes[scene].duration;
		scene += 1;
	}
	return { ...state, scene, elapsed };
}

/** Jumps to the start of a scene. Picking a scene after the end plays from there. */
export function seek(state: PlayState, index: number, scenes = SCENES): PlayState {
	const scene = Math.min(Math.max(index, 0), scenes.length - 1);
	return { scene, elapsed: 0, playing: state.playing || state.ended, ended: false };
}

/** Pause or resume; after the end, start again from scene 1. */
export function togglePlay(state: PlayState): PlayState {
	if (state.ended) return START;
	return { ...state, playing: !state.playing };
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

const TYPE_START = 800;
const TYPE_STEP = 55;
const SORTING_AT = 6_500;
const SAVE_AT = 9_000;
const LAND_AT = 2_000;
const CREAM_AT = 5_000;
const YELLOW_AT = 8_000;

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
		case 'piles':
			return { ...frameAt('piles', YELLOW_AT), lapse: null };
	}
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest --run src/lib/intro/timeline.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Lint and commit**

```bash
npx prettier --write src/lib/intro && npx eslint src/lib/intro
git add src/lib/intro
git commit -m "feat: the invite intro's scene script and timeline"
```

---

### Task 2: The demo component (`IntroDemo.svelte`)

**Files:**
- Create: `src/lib/components/NetIcon.svelte` (the capture box's net glyph, now shared)
- Modify: `src/lib/components/CaptureBox.svelte` (the inline net `<svg>` in the input form, ~lines 180–193, becomes `<NetIcon class="mt-3 size-6 shrink-0 text-leaf" />`)
- Create: `src/lib/components/IntroDemo.svelte`

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces (used by Task 3): `<IntroDemo />` with no props. DOM contract for tests:
  - a control button named "Pause" / "Play" (`aria-label`), which reads "Watch again" (visible text, no `aria-label`) once the demo ends; absent under reduced motion;
  - three buttons named "Scene 1: Catch a thought", "Scene 2: Claude sorts it", "Scene 3: Piles and ageing"; under reduced motion each has `aria-pressed`;
  - each segment's fill `<span>` carries `data-fill` (the fill, 0–1, to 3 decimals);
  - the caption is a `<p aria-live="polite" data-caption>`.

This task has no unit test of its own: the component is exercised by Task 3's e2e tests, and its logic lives in Task 1. Verify it with `npm run check` here.

- [ ] **Step 1: Extract the net icon**

`src/lib/components/NetIcon.svelte`:

```svelte
<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<!-- The butterfly net: a magnifier-like hoop with a plus, the capture box's mark. -->
<svg
	class={className}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<circle cx="9.5" cy="9.5" r="6.5" />
	<path d="M14.5 14.5 21 21" />
	<path d="M5 9.5h9M9.5 5v9" />
</svg>
```

In `CaptureBox.svelte`, add `import NetIcon from '#lib/components/NetIcon.svelte';` beside the `Butterfly` import and replace the inline `<svg class="mt-3 size-6 shrink-0 text-leaf" …>…</svg>` (the one with `<circle cx="9.5" cy="9.5" r="6.5" />`) with:

```svelte
<NetIcon class="mt-3 size-6 shrink-0 text-leaf" />
```

- [ ] **Step 2: Write the component**

`src/lib/components/IntroDemo.svelte`:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import Butterfly from '#lib/components/Butterfly.svelte';
	import NetIcon from '#lib/components/NetIcon.svelte';
	import {
		END_CAPTION,
		SCENES,
		START,
		TIDY_TITLE,
		advance,
		frameAt,
		seek,
		segmentFill,
		stillFrame,
		togglePlay,
		type Paper,
		type PlayState
	} from '#lib/intro/timeline.ts';

	// Under reduced motion nothing plays: each scene shows settled and the segments switch them.
	const still = $derived(prefersReducedMotion.current);

	let play = $state.raw<PlayState>(START);
	// Set when the demo paused itself because the tab was hidden, so it resumes on return.
	let pausedByHiding = false;

	const scene = $derived(SCENES[play.scene]);
	const frame = $derived(still ? stillFrame(scene.id) : frameAt(scene.id, play.elapsed));
	const caption = $derived(play.ended && !still ? END_CAPTION : scene.caption);

	const PAPER: Record<Paper, string> = {
		fresh: 'bg-white',
		cream: 'bg-paper-cream ring-1 ring-paper-ink/15',
		yellow: 'bg-paper-yellow ring-1 ring-paper-ink/20'
	};
	const PILES = [
		{ name: 'house', color: 'bg-pile-sage', cards: ['renew passport before spring'] },
		{ name: 'work stuff', color: 'bg-pile-sky', cards: ['send the October invoice'] },
		{ name: 'ideas', color: 'bg-pile-butter', cards: ['a bird feeder by the window'] }
	];

	// The picture is drawn at one design size and scaled to fit, so a phone sees all of it.
	let boxWidth = $state(0);
	let stageWidth = $state(1);
	const scale = $derived(boxWidth / stageWidth);

	onMount(() => {
		let last = performance.now();
		let raf = requestAnimationFrame(function loop(now) {
			// A stalled frame counts as at most 100ms, so the demo never leaps ahead.
			const delta = Math.min(now - last, 100);
			last = now;
			if (!still) play = advance(play, delta);
			raf = requestAnimationFrame(loop);
		});
		function onVisibilityChange() {
			if (document.hidden && play.playing) {
				pausedByHiding = true;
				play = { ...play, playing: false };
			} else if (!document.hidden && pausedByHiding) {
				pausedByHiding = false;
				play = { ...play, playing: true };
			}
		}
		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			cancelAnimationFrame(raf);
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	});

	function toggle() {
		pausedByHiding = false;
		play = togglePlay(play);
	}

	function jump(index: number) {
		pausedByHiding = false;
		play = seek(still ? { ...play, playing: false } : play, index);
	}

	const fillOf = (index: number) =>
		still ? (index === play.scene ? 1 : 0) : segmentFill(play, index);
</script>

<div
	bind:clientWidth={boxWidth}
	aria-hidden="true"
	class="relative aspect-[14/9] w-full overflow-hidden rounded-field bg-ground ring-1 ring-line"
>
	<div
		bind:offsetWidth={stageWidth}
		style:transform={`scale(${scale})`}
		style:visibility={boxWidth ? 'visible' : 'hidden'}
		class="absolute top-0 left-0 h-[22.5rem] w-[35rem] origin-top-left p-6"
	>
		{#key scene.id}
			<div class="h-full" in:fade={{ duration: still ? 0 : 300 }}>
				{#if frame.scene === 'catch'}
					<div class="flex h-full items-center">
						<div class="flex w-full items-start gap-3 rounded-field bg-white p-3 pl-5 shadow-float">
							<NetIcon class="mt-3 size-6 shrink-0 text-leaf" />
							<p class="min-h-18 flex-1 py-2 text-lg font-semibold text-ink">
								{#if frame.typed}
									{frame.typed}<span
										class="ml-px inline-block h-5 w-0.5 translate-y-0.5 bg-leaf"
									></span>
								{:else}
									<span class="font-medium text-muted">What's fluttering around?</span>
								{/if}
							</p>
							<span
								class="btn-primary self-center transition-transform duration-150 {frame.sorting
									? 'scale-95 bg-leaf-dark'
									: ''} {frame.typed ? '' : 'opacity-50'}"
								>{frame.sorting ? 'Sorting…' : 'Catch'}</span
							>
						</div>
					</div>
				{:else if frame.scene === 'sort'}
					<div class="space-y-4 rounded-field bg-pile-sage p-5">
						<p class="flex items-start gap-2 text-sm font-bold text-ink-soft">
							<Butterfly class="mt-0.5 size-4.5 shrink-0" />
							<span
								>Claude thinks this belongs on <strong class="font-extrabold text-ink">house</strong
								>. Edit anything, then save.</span
							>
						</p>
						<div class="chip space-y-1 px-5 py-4">
							<p class="text-xl leading-snug font-extrabold text-ink">{TIDY_TITLE}</p>
							<p class="font-medium text-muted">Notes</p>
						</div>
						<div class="flex items-center gap-3">
							<span class="font-bold text-ink-soft">Pile</span>
							<span
								class="inline-flex items-center gap-2 rounded-full bg-white py-2 pr-3 pl-4 font-bold text-ink shadow-chip ring-1 ring-line"
							>
								house
								<svg class="size-4 text-muted" viewBox="0 0 24 24" fill="none">
									<path
										d="M6 10l6 6 6-6"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							</span>
						</div>
						<div class="flex items-center gap-3">
							<span
								class="btn-primary transition-transform duration-150 {frame.saving
									? 'scale-95 bg-leaf-dark'
									: ''}">Save</span
							>
							<span class="btn-quiet">Cancel</span>
						</div>
					</div>
				{:else}
					<div class="relative grid h-full grid-cols-3 gap-4">
						{#each PILES as pile, i (pile.name)}
							<div class="flex flex-col gap-2 rounded-patch p-3 {pile.color}">
								<p class="flex items-center justify-between gap-2 px-1 font-extrabold text-ink">
									{pile.name}
									<span
										class="rounded-full bg-white/70 px-2 text-sm font-extrabold text-ink-soft"
										>{pile.cards.length + (i === 0 && frame.landed ? 1 : 0)}</span
									>
								</p>
								{#each pile.cards as card (card)}
									<p class="chip px-3 py-1.5 text-sm leading-snug font-bold text-ink">{card}</p>
								{/each}
								{#if i === 0 && frame.landed}
									<p
										in:fly={{ y: still ? 0 : -24, duration: still ? 0 : 500, easing: cubicOut }}
										class="chip flex items-start gap-2 px-3 py-1.5 text-sm leading-snug font-bold text-ink transition-colors duration-700 {PAPER[
											frame.paper
										]}"
									>
										{TIDY_TITLE}
										{#if frame.age}
											<span class="ml-auto shrink-0 font-extrabold text-paper-ink">{frame.age}</span>
										{/if}
									</p>
								{/if}
							</div>
						{/each}
						{#if frame.lapse}
							<p
								class="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-1 text-sm font-extrabold text-ink-soft shadow-chip"
							>
								{frame.lapse}
							</p>
						{/if}
						{#if frame.flying}
							<span class="intro-flight absolute top-0 left-0 text-leaf">
								<Butterfly class="size-8" />
							</span>
						{/if}
					</div>
				{/if}
			</div>
		{/key}
	</div>
</div>

<p aria-live="polite" data-caption class="mt-4 min-h-[3lh] text-center font-bold text-ink-soft">
	{caption}
</p>
<ol class="sr-only">
	{#each SCENES as s (s.id)}<li>{s.title}: {s.caption}</li>{/each}
	<li>{END_CAPTION}</li>
</ol>

<div class="mt-2 flex items-center gap-2">
	{#if !still}
		<button
			type="button"
			onclick={toggle}
			aria-label={play.ended ? undefined : play.playing ? 'Pause' : 'Play'}
			class="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-white px-3 font-bold text-leaf shadow-chip transition hover:bg-leaf-tint"
		>
			{#if play.ended}
				Watch again
			{:else if play.playing}
				<svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<rect x="6.5" y="5" width="4" height="14" rx="1.5" />
					<rect x="13.5" y="5" width="4" height="14" rx="1.5" />
				</svg>
			{:else}
				<svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
				</svg>
			{/if}
		</button>
	{/if}
	<div class="flex min-w-0 flex-1 gap-1.5">
		{#each SCENES as s, i (s.id)}
			<button
				type="button"
				onclick={() => jump(i)}
				aria-label={`Scene ${i + 1}: ${s.title}`}
				aria-pressed={still ? i === play.scene : undefined}
				class="flex min-h-11 min-w-0 flex-1 items-center rounded-full"
			>
				<span class="h-1.5 w-full overflow-hidden rounded-full bg-line">
					<span
						data-fill={fillOf(i).toFixed(3)}
						style:width={`${fillOf(i) * 100}%`}
						class="block h-full rounded-full bg-leaf"
					></span>
				</span>
			</button>
		{/each}
	</div>
</div>

<style>
	/* The one decorative moment: the butterfly drifts across into the piles. Ease-out, no bounce. */
	@keyframes intro-flight {
		from {
			transform: translate(-2rem, 12rem) rotate(-8deg);
			opacity: 0;
		}
		20% {
			opacity: 1;
		}
		to {
			transform: translate(32rem, -1rem) rotate(6deg);
			opacity: 0;
		}
	}
	.intro-flight {
		animation: intro-flight 2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
	}
</style>
```

- [ ] **Step 3: Type-check and run the existing tests**

Run: `npm run check && npx vitest --run && npx playwright test e2e/capture.test.ts`
Expected: 0 errors; all unit tests pass; capture e2e passes (the NetIcon swap changes nothing visible).

- [ ] **Step 4: Lint and commit**

```bash
npx prettier --write src/lib/components/IntroDemo.svelte src/lib/components/NetIcon.svelte src/lib/components/CaptureBox.svelte
npx eslint src/lib/components
git add src/lib/components/IntroDemo.svelte src/lib/components/NetIcon.svelte src/lib/components/CaptureBox.svelte
git commit -m "feat: the animated intro demo component"
```

---

### Task 3: The `/welcome` route and invite links

**Files:**
- Modify: `src/lib/server/routes.ts:4` (add `/welcome` to `PUBLIC_PATHS`)
- Modify: `src/lib/server/routes.test.ts:5-13`
- Create: `src/routes/welcome/+page.server.ts`
- Create: `src/routes/welcome/+page.svelte`
- Modify: `src/routes/invites/+page.server.ts:22` (`created` link)
- Modify: `src/routes/invites/+page.svelte:27` (`linkFor`)
- Modify: `e2e/invites.test.ts:3-24` (first test expects and follows a `/welcome` link)
- Create: `e2e/welcome.test.ts`

**Interfaces:**
- Consumes: `<IntroDemo />` and its DOM contract (Task 2); `findUsableInvite(db, code)` from `src/lib/server/invites.ts` (returns the invite or null); e2e helpers `createInviteCode`, `gotoReady`, `signUp`, `PASSWORD`, `waitForHydration` from `e2e/helpers.ts`.
- Produces: the public page `/welcome?invite=CODE`; invite links of the form `${origin}/welcome?invite=${code}`.

- [ ] **Step 1: Write the failing unit test**

In `src/lib/server/routes.test.ts`, add one line inside the `isPublicPath` test:

```ts
		expect(isPublicPath('/welcome')).toBe(true);
```

and rename the test to `'allows only the auth pages, the invite intro and PWA assets without a session'`.

- [ ] **Step 2: Write the failing e2e tests**

`e2e/welcome.test.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { PASSWORD, createInviteCode, gotoReady, signUp } from './helpers';

const caption = (page: Page) => page.locator('[data-caption]');

test('an invite link opens the intro, and Skip reaches sign-up with the invite', async ({ page }) => {
	const code = createInviteCode();
	await gotoReady(page, `/welcome?invite=${code}`);
	await expect(page).toHaveTitle('Welcome · Butterfly Net');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText("Here's Butterfly Net");
	await expect(caption(page)).toContainText('Catch it before it flutters off');

	await page.getByRole('link', { name: 'Skip to sign-up' }).click();
	await expect(page).toHaveURL(`/signup?invite=${code}`);
	await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
});

test('Create my account reaches sign-up and the account is made', async ({ page }) => {
	const code = createInviteCode();
	await gotoReady(page, `/welcome?invite=${code}`);
	await page.getByRole('link', { name: 'Create my account' }).click();
	await expect(page).toHaveURL(`/signup?invite=${code}`);
	await page.getByLabel('Email').fill(`welcome-${Date.now()}@test.dev`);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
});

test('a missing or used invite goes straight to the sign-up page', async ({ page }) => {
	await gotoReady(page, '/welcome');
	await expect(page).toHaveURL('/signup');
	await expect(page.getByText('Butterfly Net is invite-only right now.')).toBeVisible();

	await gotoReady(page, '/welcome?invite=not-a-real-code');
	await expect(page).toHaveURL('/signup?invite=not-a-real-code');
	await expect(page.getByText('Butterfly Net is invite-only right now.')).toBeVisible();
});

test('a bogus code with odd characters arrives at sign-up intact', async ({ page }) => {
	await gotoReady(page, `/welcome?invite=${encodeURIComponent('a&b+c d')}`);
	expect(new URL(page.url()).searchParams.get('invite')).toBe('a&b+c d');
	await expect(page.getByText('Butterfly Net is invite-only right now.')).toBeVisible();
});

test('someone already signed in goes to their piles', async ({ page }) => {
	await signUp(page);
	await gotoReady(page, `/welcome?invite=${createInviteCode()}`);
	await expect(page).toHaveURL('/');
});

test('old sign-up links still work without the intro', async ({ page }) => {
	await gotoReady(page, `/signup?invite=${createInviteCode()}`);
	await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
});

test('pause holds the demo still, and a scene can be picked', async ({ page }) => {
	await gotoReady(page, `/welcome?invite=${createInviteCode()}`);
	await page.getByRole('button', { name: 'Pause' }).click();
	const fill = page.getByRole('button', { name: 'Scene 1: Catch a thought' }).locator('[data-fill]');
	const before = await fill.getAttribute('data-fill');
	await page.waitForTimeout(600);
	expect(await fill.getAttribute('data-fill')).toBe(before);
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

	await page.getByRole('button', { name: 'Scene 3: Piles and ageing' }).click();
	await expect(caption(page)).toContainText('yellows like old paper');
});

test('hiding the tab pauses the demo and coming back resumes it', async ({ page }) => {
	await gotoReady(page, `/welcome?invite=${createInviteCode()}`);
	const setHidden = (hidden: boolean) =>
		page.evaluate((h) => {
			Object.defineProperty(document, 'hidden', { value: h, configurable: true });
			document.dispatchEvent(new Event('visibilitychange'));
		}, hidden);
	await setHidden(true);
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	await setHidden(false);
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
});

test('with reduced motion nothing plays and the scenes switch by hand', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await gotoReady(page, `/welcome?invite=${createInviteCode()}`);
	await expect(page.getByRole('button', { name: 'Pause' })).toHaveCount(0);
	const scene2 = page.getByRole('button', { name: 'Scene 2: Claude sorts it' });
	await expect(caption(page)).toContainText('Catch it before it flutters off');
	await scene2.click();
	await expect(scene2).toHaveAttribute('aria-pressed', 'true');
	await expect(caption(page)).toContainText('Claude suggests a pile');
	await page.waitForTimeout(500);
	await expect(caption(page)).toContainText('Claude suggests a pile');
});

test('with 200% text on a 320px phone the intro fits without sideways scrolling', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 800 });
	await gotoReady(page, `/welcome?invite=${createInviteCode()}`);
	await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBe(0);
	await expect(page.getByRole('link', { name: 'Create my account' })).toBeVisible();
});
```

In `e2e/invites.test.ts`, first test: change the expected link and follow it through the intro.

```ts
	await expect(link).toHaveValue(/\/welcome\?invite=[A-Za-z0-9_-]{22}$/);
	const url = new URL(await link.inputValue());
	await logOut(page);

	const joiner = `joiner-${Date.now()}@test.dev`;
	await gotoReady(page, url.pathname + url.search);
	await page.getByRole('link', { name: 'Create my account' }).click();
	await waitForHydration(page);
	await page.getByLabel('Email').fill(joiner);
```

(The rest of that test is unchanged.)

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest --run src/lib/server/routes.test.ts && npx playwright test e2e/welcome.test.ts e2e/invites.test.ts`
Expected: the unit test FAILS on `isPublicPath('/welcome')`; the welcome e2e tests FAIL (the route sends signed-out visitors to `/login`); the invites test FAILS on the `/welcome` link pattern.

- [ ] **Step 4: Implement**

`src/lib/server/routes.ts`, line 4:

```ts
const PUBLIC_PATHS = new Set([
	'/login',
	'/signup',
	'/welcome',
	'/manifest.webmanifest',
	'/service-worker.js'
]);
```

`src/routes/welcome/+page.server.ts`:

```ts
import { redirect } from '@sveltejs/kit';
import { findUsableInvite } from '../../lib/server/invites';
import type { PageServerLoad } from './$types';

/** The intro is only for someone holding a live invite; everyone else gets sign-up's own message. */
export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) redirect(303, '/');
	const code = url.searchParams.get('invite') ?? '';
	if (!code) redirect(303, '/signup');
	if (!(await findUsableInvite(locals.db, code))) {
		redirect(303, `/signup?invite=${encodeURIComponent(code)}`);
	}
	return { invite: code };
};
```

`src/routes/welcome/+page.svelte`:

```svelte
<script lang="ts">
	import { resolve } from '$app/paths';
	import Butterfly from '#lib/components/Butterfly.svelte';
	import IntroDemo from '#lib/components/IntroDemo.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Welcome · Butterfly Net</title></svelte:head>

<div class="mx-auto mt-8 max-w-xl">
	<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
		<h1 class="flex items-center gap-3 text-2xl font-extrabold">
			<span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-leaf-tint">
				<Butterfly class="size-7 text-leaf" />
			</span>
			Here's Butterfly Net
		</h1>
		<a
			href={resolve(`/signup?invite=${encodeURIComponent(data.invite)}`)}
			class="inline-flex min-h-11 items-center font-bold text-muted hover:text-ink"
			>Skip to sign-up</a
		>
	</div>
	<div class="mt-5">
		<IntroDemo />
	</div>
	<a
		href={resolve(`/signup?invite=${encodeURIComponent(data.invite)}`)}
		class="btn-primary mt-6 w-full">Create my account</a
	>
	<p class="mt-4 text-center text-sm font-bold text-muted">
		Already have an account? <a href={resolve('/login')} class="text-leaf underline">Log in</a>
	</p>
</div>
```

`src/routes/invites/+page.server.ts`, the `create` action:

```ts
		return { created: `${url.origin}/welcome?invite=${code}` };
```

`src/routes/invites/+page.svelte`, line 27:

```ts
	const linkFor = (code: string) => `${data.origin}/welcome?invite=${code}`;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest --run && npx playwright test`
Expected: all unit tests pass; all e2e tests pass, including the 10 in `e2e/welcome.test.ts`.

- [ ] **Step 6: Check, lint and commit**

```bash
npm run check
npx prettier --write src/routes/welcome src/routes/invites src/lib/server/routes.ts src/lib/server/routes.test.ts e2e/welcome.test.ts e2e/invites.test.ts
npx eslint src/routes/welcome src/routes/invites src/lib/server e2e
git add src/routes/welcome src/routes/invites src/lib/server/routes.ts src/lib/server/routes.test.ts e2e/welcome.test.ts e2e/invites.test.ts
git commit -m "feat: invite links open the /welcome intro before sign-up"
```

---

### Task 4: Look, docs and the audit pass

**Files:**
- Modify: `DESIGN.md` (new component entry after "### Card Preview (signature)"'s section)
- Modify: `CLAUDE.md` (the invite-only rule line)

- [ ] **Step 1: Look at it once, batched**

Start the e2e server's database and dev server the way Playwright does, or run a throwaway Playwright script, and capture `/welcome?invite=<fresh code>` at 390×844 and 1280×900 at 0.5 s, 4 s (scene 1 typed), 12 s (scene 2), 25 s (scene 3 yellowing) and after the end; plus one reduced-motion capture per scene. Check: the stage fits its box with no clipping at both widths; text in the stage is legible on a phone; the butterfly flies once; captions don't jump the layout (they reserve three lines); controls are 44px. Fix everything found in one batch, then confirm with at most one more round.

- [ ] **Step 2: Run the accessibility check**

With the same throwaway script, inject axe-core 4.10.2 from `https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js` on `/welcome?invite=<code>` at both widths, playing and with reduced motion. Expected: 0 violations. Fix any found.

- [ ] **Step 3: Document**

`DESIGN.md`, add after the Card Preview section:

```markdown
### Intro Demo

Invite links open `/welcome`, a skippable ~35 s re-creation of the app built from its own
classes with sample data: **Catch a thought** (the thought types itself into the capture box,
Catch reads "Sorting…"), **Claude sorts it** (the sage preview proposes **house**, Save presses)
and **Piles and ageing** (the butterfly drifts across once, the card lands on house and yellows
through cream to yellow with a "4mo" label). The picture is drawn at 35×22.5rem and scaled to
its box, so a phone sees all of it; captions and controls sit outside it and grow with text.
A three-segment progress bar jumps between scenes; one button pauses, plays and, at the end,
reads "Watch again". The demo pauses while the tab is hidden. Under reduced motion nothing
plays: each scene shows settled and the segments switch between them.
```

`CLAUDE.md`, replace the sign-up line with:

```markdown
- Sign-up is invite-only (`/invites`, admins from `ADMIN_EMAILS` in `wrangler.toml`); invite links
  open the `/welcome` intro demo, which leads to `/signup`. Non-admins get `DAILY_PARSE_LIMIT`
  Claude sorts a day. A live smoke check on production needs an invite link from Gary.
```

- [ ] **Step 4: Full verification**

Run: `npm run check && npx vitest --run && npx playwright test && npx prettier --check DESIGN.md CLAUDE.md`
Expected: 0 errors; all unit and e2e tests pass; formatting clean. Delete `e2e.db` afterwards.

- [ ] **Step 5: Commit**

```bash
git add DESIGN.md CLAUDE.md
git commit -m "docs: the intro demo in DESIGN.md and CLAUDE.md"
```
(Include any component fixes from Steps 1–2 in this commit with a `fix:` message of their own if they touch code.)
