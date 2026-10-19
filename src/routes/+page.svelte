<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CaptureBox from '#lib/components/CaptureBox.svelte';

	let { data } = $props();

	let capture = $state<CaptureBox>();
	let undo = $state<{ id: string; title: string } | null>(null);
	let undoTimer: ReturnType<typeof setTimeout> | undefined;

	const pileRefs = $derived(data.piles.map((p) => ({ id: p.id, name: p.name })));

	function showUndo(card: { id: string; title: string }) {
		undo = card;
		clearTimeout(undoTimer);
		undoTimer = setTimeout(() => (undo = null), 6000);
	}

	function focusCaptureOnN(event: KeyboardEvent) {
		if (event.key !== 'n' || event.metaKey || event.ctrlKey || event.altKey) return;
		if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
		event.preventDefault();
		capture?.focus();
	}
</script>

<svelte:window onkeydown={focusCaptureOnN} />

<CaptureBox bind:this={capture} piles={pileRefs} onSaved={invalidateAll} autofocus />

<div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
	{#each data.piles as pile (pile.id)}
		<section
			aria-labelledby={`pile-${pile.id}`}
			class="rounded-lg border border-stone-200 bg-white p-4"
		>
			<div class="flex items-baseline justify-between">
				<h2 id={`pile-${pile.id}`} class="font-semibold">{pile.name}</h2>
				<span class="text-sm text-stone-500">{pile.cards.length}</span>
			</div>
			{#if pile.cards.length === 0}
				<p class="mt-2 text-sm text-stone-400">Nothing here yet.</p>
			{:else}
				<ul class="mt-2 space-y-1.5">
					{#each pile.cards as card (card.id)}
						<li class="flex items-start gap-2">
							<form
								method="POST"
								action="?/done"
								use:enhance={() => {
									showUndo({ id: card.id, title: card.title });
									return async ({ update }) => update();
								}}
							>
								<input type="hidden" name="id" value={card.id} />
								<button
									aria-label={`Mark "${card.title}" done`}
									class="mt-0.5 size-4 rounded border border-stone-400 hover:bg-teal-100"
								></button>
							</form>
							<a href={resolve(`/card/${card.id}` as '/')} class="text-sm hover:underline"
								>{card.title}</a
							>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/each}
</div>

{#if undo}
	<div
		role="status"
		class="fixed inset-x-0 bottom-4 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-full bg-stone-900 px-4 py-2 text-sm text-white shadow-lg"
	>
		<span class="truncate">Done: {undo.title}</span>
		<form
			method="POST"
			action="?/reopen"
			use:enhance={() => {
				undo = null;
				return async ({ update }) => update();
			}}
		>
			<input type="hidden" name="id" value={undo.id} />
			<button class="font-semibold text-teal-300 underline">Undo</button>
		</form>
	</div>
{/if}
