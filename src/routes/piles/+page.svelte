<script lang="ts">
	import { enhance } from '$app/forms';
	import { MAX_PILE_NAME_LENGTH } from '#lib/limits.ts';
	import { pileColor } from '#lib/pile-color.ts';

	let { data, form } = $props();
</script>

<svelte:head><title>Manage piles · Butterfly Net</title></svelte:head>

<h1 class="text-2xl font-extrabold">Manage piles</h1>
<p class="mt-1 font-bold text-muted">
	Rename, reorder, or let one go. Each pile wears its own colour.
</p>

{#if form?.error}<p role="alert" class="mt-3 text-sm font-bold text-red-700">{form.error}</p>{/if}

<ul class="mt-5 max-w-2xl space-y-3">
	{#each data.piles as pile, i (pile.id)}
		<li class="chip p-3">
			<div class="flex flex-wrap items-center gap-2">
				<span
					aria-hidden="true"
					class="size-4 shrink-0 rounded-full ring-1 ring-ink/10 {pileColor(i)}"
				></span>
				<form
					method="POST"
					action="?/rename"
					use:enhance={() =>
						async ({ update }) =>
							update({ reset: false })}
					class="flex min-w-0 flex-1 gap-2"
				>
					<input type="hidden" name="id" value={pile.id} />
					<input
						name="name"
						value={pile.name}
						required
						maxlength={MAX_PILE_NAME_LENGTH}
						aria-label={`Name for ${pile.name}`}
						class="field min-w-0 flex-1 shadow-none"
					/>
					<button class="btn-soft">Rename</button>
				</form>
				<form method="POST" action="?/move" use:enhance class="flex gap-1">
					<input type="hidden" name="id" value={pile.id} />
					<button
						name="direction"
						value="up"
						disabled={i === 0}
						aria-label={`Move ${pile.name} up`}
						class="btn-quiet px-3 disabled:opacity-30"
					>
						<svg class="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path
								d="M6 14l6-6 6 6"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</button>
					<button
						name="direction"
						value="down"
						disabled={i === data.piles.length - 1}
						aria-label={`Move ${pile.name} down`}
						class="btn-quiet px-3 disabled:opacity-30"
					>
						<svg class="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path
								d="M6 10l6 6 6-6"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</button>
				</form>
			</div>
			<form
				method="POST"
				action="?/delete"
				use:enhance
				class="mt-2 flex flex-wrap items-center gap-2 pl-6 text-sm font-bold"
			>
				<input type="hidden" name="id" value={pile.id} />
				<span class="text-muted">{pile.card_count} card{pile.card_count === 1 ? '' : 's'}</span>
				{#if pile.card_count > 0 && data.piles.length > 1}
					<label for={`reassign-${pile.id}`} class="sr-only">Move {pile.name}'s cards to</label>
					<select
						id={`reassign-${pile.id}`}
						name="reassignTo"
						required
						class="field w-auto rounded-full py-1.5 pr-9 pl-3 text-sm shadow-none"
					>
						<option value="">Move cards to…</option>
						{#each data.piles.filter((p) => p.id !== pile.id) as target (target.id)}
							<option value={target.id}>{target.name}</option>
						{/each}
					</select>
				{/if}
				{#if data.piles.length > 1}
					<button aria-label={`Delete ${pile.name}`} class="btn-danger min-h-9 px-3 text-sm"
						>Delete</button
					>
				{:else}
					<span class="text-muted">· your last pile can’t be deleted</span>
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
		maxlength={MAX_PILE_NAME_LENGTH}
		placeholder="New pile…"
		class="field min-w-0 flex-1 rounded-full px-5"
	/>
	<button class="btn-primary shrink-0">Add pile</button>
</form>
