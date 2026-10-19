<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();

	// svelte-ignore state_referenced_locally
	// Editable copy of the subtasks; the form posts them back as parallel fields.
	let rows = $state(data.card.subtasks.map((s) => ({ text: s.text, done: s.done })));
	let confirmingDelete = $state(false);
</script>

<svelte:head><title>{data.card.title} · butterfly-net</title></svelte:head>

<a href={resolve('/')} class="text-sm text-stone-500 hover:text-stone-800">← Piles</a>

<form
	method="POST"
	action="?/save"
	use:enhance={() =>
		async ({ update }) =>
			update({ reset: false })}
	class="mt-4 max-w-2xl space-y-4"
>
	<div>
		<label for="card-title" class="block text-sm font-medium">Title</label>
		<input
			id="card-title"
			name="title"
			value={data.card.title}
			required
			maxlength="200"
			class="mt-1 w-full rounded-md border-stone-300"
		/>
	</div>
	<div>
		<label for="card-pile" class="block text-sm font-medium">Pile</label>
		<select
			id="card-pile"
			name="pileId"
			value={data.card.pile_id}
			class="mt-1 w-full rounded-md border-stone-300"
		>
			{#each data.piles as pile (pile.id)}<option value={pile.id}>{pile.name}</option>{/each}
		</select>
	</div>
	<div>
		<label for="card-notes" class="block text-sm font-medium">Notes</label>
		<textarea
			id="card-notes"
			name="notes"
			rows="4"
			maxlength="5000"
			value={data.card.notes ?? ''}
			class="mt-1 w-full rounded-md border-stone-300"></textarea>
	</div>

	<fieldset>
		<legend class="text-sm font-medium">Subtasks</legend>
		<ul class="mt-2 space-y-2">
			{#each rows as row, i (i)}
				<li class="flex items-center gap-2">
					<input
						type="checkbox"
						name="subtask_done"
						value={i}
						bind:checked={row.done}
						aria-label={`Subtask ${i + 1} done`}
						class="rounded border-stone-400"
					/>
					<input
						name="subtask_text"
						bind:value={row.text}
						maxlength="200"
						aria-label={`Subtask ${i + 1}`}
						class="flex-1 rounded-md border-stone-300 text-sm"
					/>
					<button
						type="button"
						aria-label={`Remove subtask ${i + 1}`}
						onclick={() => rows.splice(i, 1)}
						class="text-stone-500 hover:text-red-700">✕</button
					>
				</li>
			{/each}
		</ul>
		<button
			type="button"
			onclick={() => rows.push({ text: '', done: false })}
			class="mt-2 text-sm text-teal-800 hover:underline">Add subtask</button
		>
	</fieldset>

	{#if form?.error}<p role="alert" class="text-sm text-red-700">{form.error}</p>{/if}
	{#if form?.saved}<p role="status" class="text-sm text-teal-800">Saved</p>{/if}
	<button class="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800"
		>Save changes</button
	>
</form>

<div class="mt-8 flex max-w-2xl flex-wrap items-center gap-3 border-t border-stone-200 pt-4">
	{#if data.card.status === 'active'}
		<form method="POST" action="?/done" use:enhance>
			<button class="rounded-md border border-stone-300 px-4 py-2 hover:bg-stone-100"
				>Mark done</button
			>
		</form>
	{:else}
		<form method="POST" action="?/reopen" use:enhance>
			<button class="rounded-md border border-stone-300 px-4 py-2 hover:bg-stone-100">Reopen</button
			>
		</form>
	{/if}

	{#if confirmingDelete}
		<form method="POST" action="?/delete" use:enhance class="flex items-center gap-2">
			<span class="text-sm">Delete for good?</span>
			<button class="rounded-md bg-red-700 px-3 py-2 text-white hover:bg-red-800"
				>Yes, delete it</button
			>
			<button
				type="button"
				onclick={() => (confirmingDelete = false)}
				class="px-3 py-2 text-stone-600">Keep it</button
			>
		</form>
	{:else}
		<button
			type="button"
			onclick={() => (confirmingDelete = true)}
			class="ml-auto text-sm text-red-700 hover:underline">Delete card</button
		>
	{/if}
</div>
