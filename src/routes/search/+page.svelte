<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<svelte:head><title>Search · butterfly-net</title></svelte:head>

<form method="GET" class="flex max-w-2xl gap-2">
	<label for="q" class="sr-only">Search your cards</label>
	<input
		id="q"
		name="q"
		type="search"
		value={data.q}
		placeholder="Search your cards…"
		class="flex-1 rounded-md border-stone-300"
	/>
	<button class="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800"
		>Search</button
	>
</form>

{#if data.results}
	{#if data.results.length === 0}
		<p class="mt-6 text-stone-500">No cards match.</p>
	{:else}
		<ul class="mt-6 max-w-2xl space-y-2">
			{#each data.results as result (result.id)}
				<li class="rounded-md border border-stone-200 bg-white p-3">
					<a href={resolve('/card/[id]', { id: result.id })} class="font-medium hover:underline"
						>{result.title}</a
					>
					<div class="mt-1 flex gap-2 text-xs text-stone-500">
						<span>{result.pile_name}</span>
						{#if result.status === 'done'}<span class="rounded bg-stone-200 px-1.5 text-stone-700"
								>Archived</span
							>{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
{/if}
