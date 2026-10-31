<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { cardAge } from '#lib/card-age.ts';
	import { MAX_NOTES_LENGTH, MAX_TITLE_LENGTH } from '#lib/limits.ts';
	import { pileColor } from '#lib/pile-color.ts';

	let { data, form } = $props();

	const seed = () => data.card.subtasks.map((s) => ({ text: s.text, done: s.done }));

	// Editable copy of the subtasks; the form posts them back as parallel fields.
	// Re-seeded when a different card loads and after each successful save, so the
	// rows match what the server kept (blank rows dropped) without clobbering
	// unsaved edits on other actions.
	let rows = $state(seed());
	let seededFor: string | undefined;
	$effect(() => {
		if (data.card.id !== seededFor) {
			if (seededFor !== undefined) rows = seed();
			seededFor = data.card.id;
		}
	});
	let confirmingDelete = $state(false);

	const age = $derived(cardAge(data.card.created_at, data.now));

	// The card sits on a patch of its pile's colour.
	const color = $derived(pileColor(data.piles.findIndex((p) => p.id === data.card.pile_id)));
</script>

<svelte:head><title>{data.card.title} · Butterfly Net</title></svelte:head>

<a href={resolve('/')} class="font-bold text-muted hover:text-ink">← Piles</a>

<form
	method="POST"
	action="?/save"
	use:enhance={() =>
		async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') rows = seed();
		}}
	class="mt-4 max-w-2xl space-y-4 rounded-field p-5 {color}"
>
	<div class="chip space-y-4 px-5 py-4">
		<div>
			<label for="card-title" class="block text-sm font-bold text-ink-soft">Title</label>
			<input
				id="card-title"
				name="title"
				value={data.card.title}
				required
				maxlength={MAX_TITLE_LENGTH}
				class="field mt-1 text-lg font-extrabold"
			/>
			<p class="mt-1.5 px-1 text-sm font-bold text-muted">
				Caught <time datetime={data.card.created_at.toISOString()}>{age.phrase}</time>
			</p>
		</div>
		<div>
			<label for="card-pile" class="block text-sm font-bold text-ink-soft">Pile</label>
			<select
				id="card-pile"
				name="pileId"
				value={data.card.pile_id}
				class="field mt-1 w-auto pr-10"
			>
				{#each data.piles as pile (pile.id)}<option value={pile.id}>{pile.name}</option>{/each}
			</select>
		</div>
		<div>
			<label for="card-notes" class="block text-sm font-bold text-ink-soft">Notes</label>
			<textarea
				id="card-notes"
				name="notes"
				rows="4"
				maxlength={MAX_NOTES_LENGTH}
				value={data.card.notes ?? ''}
				class="field mt-1"></textarea>
		</div>

		<fieldset>
			<legend class="text-sm font-bold text-ink-soft">Subtasks</legend>
			<ul class="mt-2 space-y-2">
				{#each rows as row, i (i)}
					<li class="flex items-center gap-2">
						<input
							type="checkbox"
							name="subtask_done"
							value={i}
							bind:checked={row.done}
							aria-label={`Subtask ${i + 1} done`}
							class="size-5 rounded-full border-muted text-leaf focus:ring-leaf"
						/>
						<input
							name="subtask_text"
							bind:value={row.text}
							maxlength={MAX_TITLE_LENGTH}
							aria-label={`Subtask ${i + 1}`}
							class="field flex-1 py-1.5 text-sm"
						/>
						<button
							type="button"
							aria-label={`Remove subtask ${i + 1}`}
							onclick={() => rows.splice(i, 1)}
							class="flex size-9 items-center justify-center rounded-full text-muted hover:bg-line hover:text-red-700"
							>✕</button
						>
					</li>
				{/each}
			</ul>
			<button
				type="button"
				onclick={() => rows.push({ text: '', done: false })}
				class="mt-2 text-sm font-bold text-leaf hover:underline">Add subtask</button
			>
		</fieldset>
	</div>

	<div class="flex flex-wrap items-center gap-3">
		<button class="btn-primary">Save changes</button>
		{#if form?.error}<p role="alert" class="text-sm font-bold text-red-700">{form.error}</p>{/if}
		{#if form?.saved}<p role="status" class="text-sm font-bold text-leaf">Saved</p>{/if}
	</div>
</form>

<div class="mt-6 flex max-w-2xl flex-wrap items-center gap-3">
	{#if data.card.status === 'active'}
		<form method="POST" action="?/done" use:enhance>
			<button class="btn-soft">Mark done</button>
		</form>
	{:else}
		<form method="POST" action="?/reopen" use:enhance>
			<button class="btn-soft">Reopen</button>
		</form>
	{/if}

	{#if confirmingDelete}
		<form method="POST" action="?/delete" use:enhance class="flex flex-wrap items-center gap-2">
			<span class="text-sm font-bold">Delete for good?</span>
			<button
				class="inline-flex min-h-11 items-center rounded-full bg-red-700 px-4 font-extrabold text-white hover:bg-red-800"
				>Yes, delete it</button
			>
			<button type="button" onclick={() => (confirmingDelete = false)} class="btn-quiet"
				>Keep it</button
			>
		</form>
	{:else}
		<button
			type="button"
			onclick={() => (confirmingDelete = true)}
			class="btn-danger ml-auto text-sm">Delete card</button
		>
	{/if}
</div>
