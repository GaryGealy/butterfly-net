<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<svelte:head><title>Manage piles · butterfly-net</title></svelte:head>

<h1 class="text-xl font-semibold">Manage piles</h1>

{#if form?.error}<p role="alert" class="mt-3 text-sm text-red-700">{form.error}</p>{/if}

<ul class="mt-4 max-w-2xl space-y-3">
	{#each data.piles as pile, i (pile.id)}
		<li class="rounded-md border border-stone-200 bg-white p-3">
			<div class="flex flex-wrap items-center gap-2">
				<form
					method="POST"
					action="?/rename"
					use:enhance={() =>
						async ({ update }) =>
							update({ reset: false })}
					class="flex flex-1 gap-2"
				>
					<input type="hidden" name="id" value={pile.id} />
					<input
						name="name"
						value={pile.name}
						required
						maxlength="40"
						aria-label={`Name for ${pile.name}`}
						class="min-w-0 flex-1 rounded-md border-stone-300"
					/>
					<button class="rounded-md border border-stone-300 px-3 py-1 text-sm hover:bg-stone-100"
						>Rename</button
					>
				</form>
				<form method="POST" action="?/move" use:enhance class="flex gap-1">
					<input type="hidden" name="id" value={pile.id} />
					<button
						name="direction"
						value="up"
						disabled={i === 0}
						aria-label={`Move ${pile.name} up`}
						class="rounded px-2 py-1 hover:bg-stone-100 disabled:opacity-30">↑</button
					>
					<button
						name="direction"
						value="down"
						disabled={i === data.piles.length - 1}
						aria-label={`Move ${pile.name} down`}
						class="rounded px-2 py-1 hover:bg-stone-100 disabled:opacity-30">↓</button
					>
				</form>
			</div>
			<form
				method="POST"
				action="?/delete"
				use:enhance
				class="mt-2 flex flex-wrap items-center gap-2 text-sm"
			>
				<input type="hidden" name="id" value={pile.id} />
				<span class="text-stone-500">{pile.card_count} card{pile.card_count === 1 ? '' : 's'}</span>
				{#if pile.card_count > 0 && data.piles.length > 1}
					<label for={`reassign-${pile.id}`} class="sr-only">Move {pile.name}'s cards to</label>
					<select
						id={`reassign-${pile.id}`}
						name="reassignTo"
						required
						class="rounded-md border-stone-300 py-1 text-sm"
					>
						<option value="">Move cards to…</option>
						{#each data.piles.filter((p) => p.id !== pile.id) as target (target.id)}
							<option value={target.id}>{target.name}</option>
						{/each}
					</select>
				{/if}
				{#if data.piles.length > 1}
					<button aria-label={`Delete ${pile.name}`} class="text-red-700 hover:underline"
						>Delete</button
					>
				{:else}
					<span class="text-stone-500">· your last pile can’t be deleted</span>
				{/if}
			</form>
		</li>
	{/each}
</ul>

<form method="POST" action="?/create" use:enhance class="mt-6 flex max-w-2xl gap-2">
	<label for="new-pile" class="sr-only">New pile name</label>
	<input
		id="new-pile"
		name="name"
		required
		maxlength="40"
		placeholder="New pile…"
		class="flex-1 rounded-md border-stone-300"
	/>
	<button class="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800"
		>Add pile</button
	>
</form>
