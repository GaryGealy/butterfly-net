<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Butterfly from '#lib/components/Butterfly.svelte';
	import CaptureBox from '#lib/components/CaptureBox.svelte';
	import { cardAge, type AgeStage } from '#lib/card-age.ts';
	import { focusById, neighbourFocusId } from '#lib/focus.ts';
	import { pileColor } from '#lib/pile-color.ts';
	import { MediaQuery } from 'svelte/reactivity';

	let { data } = $props();

	let capture = $state<CaptureBox>();
	type Toast =
		| { kind: 'done'; id: string; title: string }
		| { kind: 'moved'; id: string; title: string; pileName: string; from: string; to: string };
	let undo = $state<Toast | null>(null);
	let undoTimer: ReturnType<typeof setTimeout> | undefined;

	// Dragging is for a mouse or trackpad; on a phone a card moves from its own page.
	const finePointer = new MediaQuery('pointer: fine');
	let dragging = $state<{ id: string; title: string; from: string } | null>(null);
	let over = $state<string | null>(null);
	// Where a card shows while its move is saving, so it moves the moment it is dropped.
	let placed = $state<Record<string, string>>({});
	let moveError = $state<string | null>(null);

	const PAPER: Record<AgeStage, string> = {
		fresh: '',
		cream: 'bg-paper-cream ring-1 ring-paper-ink/15',
		yellow: 'bg-paper-yellow ring-1 ring-paper-ink/20',
		deep: 'bg-paper-deep ring-1 ring-paper-ink/25'
	};

	const pileRefs = $derived(data.piles.map((p) => ({ id: p.id, name: p.name })));

	const piles = $derived.by(() => {
		const all = data.piles.flatMap((p) => p.cards.map((c) => ({ ...c, at: placed[c.id] ?? p.id })));
		return data.piles.map((p) => ({
			...p,
			cards: all
				.filter((c) => c.at === p.id)
				.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
		}));
	});

	function showUndo(toast: Toast) {
		undo = toast;
		clearTimeout(undoTimer);
		undoTimer = setTimeout(() => (undo = null), 6000);
	}

	async function move(
		card: { id: string; title: string },
		from: string,
		to: string,
		isUndo = false
	) {
		if (from === to) return;
		moveError = null;
		placed = { ...placed, [card.id]: to };
		try {
			const body = new FormData();
			body.set('id', card.id);
			body.set('pileId', to);
			const response = await fetch('?/move', {
				method: 'POST',
				body,
				headers: { 'x-sveltekit-action': 'true' }
			});
			const result = deserialize(await response.text());
			if (result.type !== 'success') throw new Error(`move failed: ${result.type}`);
			await invalidateAll();
			if (isUndo) {
				undo = null;
				await focusById(`card-${card.id}`);
			} else {
				const pileName = data.piles.find((p) => p.id === to)?.name ?? '';
				showUndo({ kind: 'moved', id: card.id, title: card.title, pileName, from, to });
			}
		} catch {
			undo = null;
			moveError = `Couldn\u2019t move \u201c${card.title}\u201d. Try again.`;
		} finally {
			placed = Object.fromEntries(Object.entries(placed).filter(([id]) => id !== card.id));
		}
	}

	function dropOn(pileId: string, event: DragEvent) {
		event.preventDefault();
		const card = dragging;
		dragging = null;
		over = null;
		if (card) move(card, card.from, pileId);
	}

	function focusCaptureOnN(event: KeyboardEvent) {
		if (event.key !== 'n' || event.metaKey || event.ctrlKey || event.altKey) return;
		if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
		event.preventDefault();
		capture?.focus();
	}
</script>

<svelte:window onkeydown={focusCaptureOnN} />

<h1 class="sr-only">Your piles</h1>

<CaptureBox bind:this={capture} piles={pileRefs} onSaved={invalidateAll} autofocus />

<div class="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
	{#each piles as pile, i (pile.id)}
		<section
			id={`pile-section-${pile.id}`}
			aria-labelledby={`pile-${pile.id}`}
			tabindex="-1"
			class="flex min-h-40 flex-col gap-3 rounded-patch p-4 transition-shadow {pileColor(
				i
			)} {over === pile.id ? 'ring-4 ring-leaf' : ''}"
			ondragover={(event) => {
				if (!dragging || dragging.from === pile.id) return;
				event.preventDefault();
				if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
				over = pile.id;
			}}
			ondragleave={(event) => {
				if (over === pile.id && !event.currentTarget.contains(event.relatedTarget as Node | null))
					over = null;
			}}
			ondrop={(event) => dropOn(pile.id, event)}
		>
			<div class="flex items-center justify-between gap-3 px-1.5">
				<h2 id={`pile-${pile.id}`} class="min-w-0 text-lg font-extrabold [overflow-wrap:anywhere]">
					{pile.name}
				</h2>
				<span class="rounded-full bg-white/70 px-2.5 py-0.5 text-sm font-extrabold text-ink-soft"
					>{pile.cards.length}</span
				>
			</div>
			{#if pile.cards.length === 0}
				<p class="flex items-center gap-2 px-1.5 font-bold text-ink-soft">
					<Butterfly class="size-5" />
					Nothing here yet. Nice and quiet.
				</p>
			{:else}
				<ul class="space-y-2">
					{#each pile.cards as card (card.id)}
						{@const age = cardAge(card.created_at, data.now)}
						<li
							class="chip flex items-center gap-1 py-1.5 pr-3.5 pl-1.5 {PAPER[
								age.stage
							]} {finePointer.current ? 'cursor-grab' : ''} {dragging?.id === card.id
								? 'opacity-40'
								: ''}"
							data-age={age.stage}
							draggable={finePointer.current}
							ondragstart={(event) => {
								event.dataTransfer?.setData('text/plain', card.id);
								if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
								moveError = null;
								dragging = { id: card.id, title: card.title, from: pile.id };
							}}
							ondragend={() => {
								dragging = null;
								over = null;
							}}
						>
							<form
								method="POST"
								action="?/done"
								use:enhance={({ formElement }) => {
									showUndo({ kind: 'done', id: card.id, title: card.title });
									const next = neighbourFocusId(
										formElement,
										'button[id^="done-"]',
										`pile-section-${pile.id}`
									);
									return async ({ update }) => {
										await update();
										await focusById(next);
									};
								}}
							>
								<input type="hidden" name="id" value={card.id} />
								<button
									id={`done-${card.id}`}
									aria-label={`Mark "${card.title}" done`}
									class="flex size-11 items-center justify-center rounded-full text-muted hover:bg-leaf-tint hover:text-leaf"
								>
									<svg class="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
										<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8" />
									</svg>
								</button>
							</form>
							<a
								id={`card-${card.id}`}
								draggable="false"
								href={resolve('/card/[id]', { id: card.id })}
								class="flex min-h-11 min-w-0 flex-1 items-center leading-snug font-bold [overflow-wrap:anywhere] hover:underline"
								>{card.title}</a
							>
							{#if age.label}
								<span
									title={`Caught ${age.phrase}`}
									class="ml-auto shrink-0 pl-2 text-sm font-extrabold text-paper-ink"
									><span aria-hidden="true">{age.label}</span><span class="sr-only"
										>caught {age.phrase}</span
									></span
								>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/each}
</div>

{#if moveError}
	<div
		role="alert"
		class="fixed inset-x-0 bottom-5 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-full bg-white px-5 py-3 text-sm font-bold text-red-800 shadow-float"
	>
		{moveError}
	</div>
{:else if undo}
	<div
		role="status"
		class="fixed inset-x-0 bottom-5 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-full bg-white py-1.5 pr-1.5 pl-5 text-sm font-bold shadow-float"
	>
		{#if undo.kind === 'done'}
			<span class="truncate">Done: {undo.title}</span>
			<form
				method="POST"
				action="?/reopen"
				use:enhance={() => {
					const reopened = undo?.id;
					undo = null;
					return async ({ update }) => {
						await update();
						await focusById(reopened && `done-${reopened}`);
					};
				}}
			>
				<input type="hidden" name="id" value={undo.id} />
				<button
					class="inline-flex min-h-11 items-center rounded-full bg-leaf-tint px-4 font-extrabold text-leaf-dark"
					>Undo</button
				>
			</form>
		{:else}
			{@const moved = undo}
			<span class="truncate">Moved to {moved.pileName}: {moved.title}</span>
			<button
				type="button"
				class="inline-flex min-h-11 shrink-0 items-center rounded-full bg-leaf-tint px-4 font-extrabold text-leaf-dark"
				onclick={() => move(moved, moved.to, moved.from, true)}>Undo</button
			>
		{/if}
	</div>
{/if}
