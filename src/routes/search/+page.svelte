<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<svelte:head><title>Search · Butterfly Net</title></svelte:head>

<h1 class="text-2xl font-extrabold">Search</h1>
<p class="mt-1 font-bold text-muted">Every card you've caught, on a pile or flown away.</p>

<form method="GET" class="mt-5 flex max-w-2xl gap-2">
	<label for="q" class="sr-only">Search your cards</label>
	<input
		id="q"
		name="q"
		type="search"
		value={data.q}
		placeholder="What was that idea…"
		class="field min-w-0 flex-1 rounded-full px-5"
	/>
	<button class="btn-primary shrink-0">Search</button>
</form>

{#if data.results}
	{#if data.results.length === 0}
		<p class="mt-6 font-bold text-muted">No cards match.</p>
	{:else}
		<ul class="mt-6 max-w-2xl space-y-2">
			{#each data.results as result (result.id)}
				<li class="chip px-5 py-3">
					<a href={resolve('/card/[id]', { id: result.id })} class="font-extrabold hover:underline"
						>{result.title}</a
					>
					<div class="mt-1 flex flex-wrap gap-2 text-sm font-bold text-muted">
						<span>{result.pile_name}</span>
						{#if result.status === 'done'}<span class="rounded-full bg-line px-2 text-ink-soft"
								>Archived</span
							>{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
{/if}
