<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Butterfly from '#lib/components/Butterfly.svelte';

	let { data } = $props();

	const formatDate = (date: Date | null) =>
		date
			? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
			: '';
</script>

<svelte:head><title>Archive · Butterfly Net</title></svelte:head>

<h1 class="text-2xl font-extrabold">Archive</h1>
<p class="mt-1 font-bold text-muted">Cards that flew away. Any of them can come back.</p>

{#if data.cards.length === 0}
	<p class="mt-5 flex items-center gap-2 font-bold text-muted">
		<Butterfly class="size-5" />
		Nothing archived yet.
	</p>
{:else}
	<ul class="mt-5 max-w-2xl space-y-2">
		{#each data.cards as card (card.id)}
			<li class="chip flex flex-wrap items-center gap-3 px-5 py-3">
				<div class="min-w-0 flex-1">
					<a href={resolve('/card/[id]', { id: card.id })} class="font-extrabold hover:underline"
						>{card.title}</a
					>
					<div class="mt-1 text-sm font-bold text-muted">
						{card.pile_name} · done {formatDate(card.done_at)}
					</div>
				</div>
				<form method="POST" action="?/reopen" use:enhance>
					<input type="hidden" name="id" value={card.id} />
					<button class="btn-soft bg-leaf-tint text-leaf-dark hover:bg-pile-sage">Reopen</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}
