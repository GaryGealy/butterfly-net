<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data } = $props();

	const formatDate = (date: Date | null) =>
		date
			? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
			: '';
</script>

<svelte:head><title>Archive · butterfly-net</title></svelte:head>

<h1 class="text-xl font-semibold">Archive</h1>

{#if data.cards.length === 0}
	<p class="mt-4 text-stone-500">Nothing archived yet.</p>
{:else}
	<ul class="mt-4 max-w-2xl space-y-2">
		{#each data.cards as card (card.id)}
			<li class="flex items-center gap-3 rounded-md border border-stone-200 bg-white p-3">
				<div class="flex-1">
					<a href={resolve('/card/[id]', { id: card.id })} class="font-medium hover:underline"
						>{card.title}</a
					>
					<div class="mt-1 text-xs text-stone-500">
						{card.pile_name} · done {formatDate(card.done_at)}
					</div>
				</div>
				<form method="POST" action="?/reopen" use:enhance>
					<input type="hidden" name="id" value={card.id} />
					<button class="rounded-md border border-stone-300 px-3 py-1 text-sm hover:bg-stone-100"
						>Reopen</button
					>
				</form>
			</li>
		{/each}
	</ul>
{/if}
