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
									{frame.typed}<span class="ml-px inline-block h-5 w-0.5 translate-y-0.5 bg-leaf"
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
									<span class="rounded-full bg-white/70 px-2 text-sm font-extrabold text-ink-soft"
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
											<span class="ml-auto shrink-0 font-extrabold text-paper-ink">{frame.age}</span
											>
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
					<path
						d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"
					/>
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
