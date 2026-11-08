<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { cardAge } from '#lib/card-age.ts';
	import { focusById } from '#lib/focus.ts';
	import { MAX_NOTES_LENGTH, MAX_SUBTASKS, MAX_TITLE_LENGTH } from '#lib/limits.ts';
	import { pileColor } from '#lib/pile-color.ts';
	import { sameStepText } from '#lib/step-text.ts';

	let { data, form } = $props();

	interface Link {
		url: string | null;
		linkTitle: string | null;
	}
	interface Proposal extends Link {
		text: string;
		keep: boolean;
	}

	const seed = () =>
		data.card.subtasks.map((s) => ({
			text: s.text,
			done: s.done,
			url: s.url,
			linkTitle: s.linkTitle
		}));

	// Editable copy of the subtasks; the form posts them back as parallel fields.
	// Re-seeded when a different card loads and after each successful save, so the
	// rows match what the server kept (blank rows dropped) without clobbering
	// unsaved edits on other actions.
	let rows = $state(seed());
	// Subtask ids already on the page, so Add appends only the rows it created.
	let knownIds = new SvelteSet<string>();
	let seededFor: string | undefined;
	$effect(() => {
		if (data.card.id !== seededFor) {
			if (seededFor !== undefined) reseed();
			else knownIds = new SvelteSet(data.card.subtasks.map((s) => s.id));
			seededFor = data.card.id;
		}
	});

	function reseed() {
		rows = seed();
		knownIds = new SvelteSet(data.card.subtasks.map((s) => s.id));
		proposals = null;
		sortsOverride = undefined;
	}

	// Break it down: Claude's suggested steps, which the user ticks before adding.
	let proposals = $state<Proposal[] | null>(null);
	let breaking = $state(false);
	let adding = $state(false);
	let breakdownError = $state('');
	let added = $state('');
	// The count the last press reported; the page load's count until then.
	let sortsOverride = $state<number | null | undefined>(undefined);
	const sortsLeft = $derived(sortsOverride === undefined ? data.sortsLeft : sortsOverride);
	const BREAKDOWN_FAILED = "Couldn't break this down right now. Try again later.";

	// Suggestions that repeat a row already on the page (saved or not) aren't offered.
	const shown = $derived(
		(proposals ?? []).filter((p) => !rows.some((r) => sameStepText(r.text, p.text)))
	);
	const keeping = $derived(shown.filter((p) => p.keep));
	// Count unsaved rows too, so a later Save can't push new steps past the limit.
	const room = $derived(
		Math.max(0, MAX_SUBTASKS - Math.max(data.card.subtasks.length, rows.length))
	);

	const host = (url: string) => new URL(url).hostname.replace(/^www\./, '');
	const plural = (n: number) => `${n} ${n === 1 ? 'step' : 'steps'}`;

	async function breakDown() {
		breaking = true;
		breakdownError = '';
		added = '';
		try {
			const response = await fetch(`/api/cards/${data.card.id}/breakdown`, { method: 'POST' });
			const body = (await response.json().catch(() => ({}))) as {
				steps?: Array<Link & { text: string }>;
				sortsLeft?: number | null;
				error?: string;
			};
			if (body.sortsLeft !== undefined) sortsOverride = body.sortsLeft;
			if (response.ok && body.steps) {
				proposals = body.steps.map((step) => ({ ...step, keep: true }));
			} else if (body.error === 'out-of-sorts') {
				sortsOverride = 0;
			} else {
				breakdownError = BREAKDOWN_FAILED;
			}
		} catch {
			breakdownError = BREAKDOWN_FAILED;
		} finally {
			breaking = false;
		}
	}

	async function addKept() {
		adding = true;
		breakdownError = '';
		try {
			const steps = keeping.map(({ text, url, linkTitle }) => ({ text, url, linkTitle }));
			const response = await fetch(`/api/cards/${data.card.id}/subtasks`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ steps })
			});
			if (!response.ok) throw new Error(`append failed: ${response.status}`);
			const { subtasks } = (await response.json()) as {
				subtasks: Array<Link & { id: string; text: string; done: boolean }>;
			};
			const fresh = subtasks.filter((s) => !knownIds.has(s.id));
			for (const s of fresh) {
				knownIds.add(s.id);
				rows.push({ text: s.text, done: s.done, url: s.url, linkTitle: s.linkTitle });
			}
			proposals = null;
			added = `Added ${plural(fresh.length)}`;
		} catch {
			breakdownError = BREAKDOWN_FAILED;
		} finally {
			adding = false;
		}
	}
	let confirmingDelete = $state(false);

	// Mark done and Reopen swap places; keep focus on whichever one is showing now.
	const keepStatusFocus =
		() =>
		async ({ update }: { update: () => Promise<void> }) => {
			await update();
			await focusById('status-toggle');
		};

	const age = $derived(cardAge(data.card.created_at, data.now));

	// The card sits on a patch of its pile's colour.
	const color = $derived(pileColor(data.piles.findIndex((p) => p.id === data.card.pile_id)));
</script>

<svelte:head><title>{data.card.title} · Butterfly Net</title></svelte:head>

<a href={resolve('/')} class="inline-flex min-h-11 items-center font-bold text-muted hover:text-ink"
	>← Piles</a
>

<h1 class="sr-only">{data.card.title}</h1>

<form
	method="POST"
	action="?/save"
	use:enhance={() =>
		async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') reseed();
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
				class="field mt-1 w-auto max-w-full pr-10"
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

		<fieldset class="min-w-0">
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
							class="field min-w-0 flex-1 py-1.5 text-sm"
						/>
						<input type="hidden" name="subtask_url" value={row.url ?? ''} />
						<input type="hidden" name="subtask_link_title" value={row.linkTitle ?? ''} />
						{#if row.url}
							<a
								href={row.url}
								target="_blank"
								rel="noopener noreferrer"
								aria-label={`Open: ${row.linkTitle ?? host(row.url)}`}
								title={`Open: ${row.linkTitle ?? host(row.url)}`}
								class="flex size-11 shrink-0 items-center justify-center rounded-full bg-leaf-tint text-leaf hover:bg-leaf hover:text-white"
							>
								<svg class="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true"
									><path
										d="M9 7h8v8M17 7L7 17"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/></svg
								>
							</a>
						{/if}
						<button
							type="button"
							aria-label={`Remove subtask ${i + 1}`}
							onclick={() => rows.splice(i, 1)}
							class="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-line hover:text-red-700"
						>
							<svg class="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true"
								><path
									d="M7 7l10 10M17 7L7 17"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
								/></svg
							>
						</button>
					</li>
				{/each}
			</ul>
			<button
				type="button"
				onclick={() => rows.push({ text: '', done: false, url: null, linkTitle: null })}
				class="mt-1 inline-flex min-h-11 items-center text-sm font-bold text-leaf hover:underline"
				>Add subtask</button
			>

			{#if data.card.status === 'active'}
				<div class="mt-2 flex flex-wrap items-center gap-3">
					<button
						type="button"
						onclick={breakDown}
						disabled={breaking || adding || sortsLeft === 0}
						aria-busy={breaking}
						class="btn-soft">{breaking ? 'Finding steps…' : 'Break it down'}</button
					>
					{#if sortsLeft === 0}
						<p class="text-sm font-bold text-muted">You're out of sorts for today.</p>
					{/if}
					{#if breakdownError}
						<p role="alert" class="text-sm font-bold text-red-700">{breakdownError}</p>
					{/if}
					{#if added}<p role="status" class="text-sm font-bold text-leaf">{added}</p>{/if}
				</div>

				{#if proposals && shown.length > 0}
					<fieldset class="mt-3 min-w-0 rounded-field border border-line bg-white p-4">
						<legend class="px-1 text-sm font-bold text-ink-soft">Suggested steps</legend>
						<ul class="space-y-3">
							{#each shown as proposal (proposal.text)}
								<li>
									<label class="flex items-start gap-3">
										<input
											type="checkbox"
											bind:checked={proposal.keep}
											class="mt-0.5 size-5 shrink-0 rounded border-muted text-leaf focus:ring-leaf"
										/>
										<span class="min-w-0 break-words">
											<span class="block text-sm font-bold">{proposal.text}</span>
											{#if proposal.url}
												<span class="block text-sm text-muted"
													>{proposal.linkTitle} · {host(proposal.url)}</span
												>
											{/if}
										</span>
									</label>
								</li>
							{/each}
						</ul>
						{#if keeping.length > room}
							<p class="mt-3 text-sm font-bold text-red-700">
								Only {room} more fit on this card.
							</p>
						{/if}
						<div class="mt-4 flex flex-wrap items-center gap-3">
							<button
								type="button"
								onclick={addKept}
								disabled={adding || keeping.length === 0 || keeping.length > room}
								class="btn-primary">Add {plural(keeping.length)}</button
							>
							<button type="button" onclick={() => (proposals = null)} class="btn-quiet"
								>Cancel</button
							>
						</div>
					</fieldset>
				{:else if proposals}
					<p class="mt-2 text-sm font-bold text-muted">No new steps to suggest.</p>
				{/if}
			{/if}
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
		<form method="POST" action="?/done" use:enhance={keepStatusFocus}>
			<button id="status-toggle" class="btn-soft">Mark done</button>
		</form>
	{:else}
		<form method="POST" action="?/reopen" use:enhance={keepStatusFocus}>
			<button id="status-toggle" class="btn-soft">Reopen</button>
		</form>
	{/if}

	{#if confirmingDelete}
		<form method="POST" action="?/delete" use:enhance class="flex flex-wrap items-center gap-2">
			<span class="text-sm font-bold">Delete for good?</span>
			<button
				class="inline-flex min-h-11 items-center rounded-full bg-red-700 px-4 font-extrabold text-white hover:bg-red-800"
				>Yes, delete it</button
			>
			<button
				id="keep-card"
				type="button"
				onclick={() => {
					confirmingDelete = false;
					focusById('delete-card');
				}}
				class="btn-quiet">Keep it</button
			>
		</form>
	{:else}
		<button
			id="delete-card"
			type="button"
			onclick={() => {
				confirmingDelete = true;
				focusById('keep-card');
			}}
			class="btn-danger ml-auto text-sm">Delete card</button
		>
	{/if}
</div>
