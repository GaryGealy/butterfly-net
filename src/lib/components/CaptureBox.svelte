<script lang="ts">
	import type { ParseResult, PileRef } from '../types.ts';

	interface Props {
		piles: PileRef[];
		onSaved?: () => void | Promise<void>;
		autofocus?: boolean;
	}

	let { piles, onSaved, autofocus = false }: Props = $props();

	const MAX_TITLE = 200;

	let phase = $state<'input' | 'parsing' | 'preview' | 'saving'>('input');
	let text = $state('');
	let title = $state('');
	let notes = $state('');
	let subtasks = $state<string[]>([]);
	// A pile id, `new:<name>` for a proposed pile, or '' until chosen.
	let pileChoice = $state('');
	let proposedPile = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let caught = $state(false);
	let textInput = $state<HTMLTextAreaElement>();
	let titleInput = $state<HTMLInputElement>();

	export function focus() {
		textInput?.focus();
	}

	$effect(() => {
		if (autofocus) textInput?.focus();
	});

	$effect(() => {
		if (phase === 'preview') titleInput?.focus();
	});

	// Mirrors the server's fallback for when /api/parse itself is unreachable.
	function localFallback(raw: string): ParseResult {
		const long = raw.length > MAX_TITLE;
		return {
			title: long ? `${raw.slice(0, MAX_TITLE - 1).trimEnd()}…` : raw,
			pile: null,
			notes: long ? raw : null,
			subtasks: [],
			source: 'fallback'
		};
	}

	function showPreview(result: ParseResult) {
		title = result.title;
		notes = result.notes ?? '';
		subtasks = [...result.subtasks];
		proposedPile = result.pile?.kind === 'new' ? result.pile.name : null;
		pileChoice =
			result.pile?.kind === 'existing'
				? result.pile.id
				: result.pile?.kind === 'new'
					? `new:${result.pile.name}`
					: '';
		notice =
			result.source === 'fallback' ? "Couldn't sort this one automatically — pick a pile." : null;
		phase = 'preview';
	}

	async function parse(event: SubmitEvent) {
		event.preventDefault();
		const raw = text.trim();
		if (!raw || phase !== 'input') return;
		phase = 'parsing';
		caught = false;
		try {
			const response = await fetch('/api/parse', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text: raw })
			});
			if (!response.ok) throw new Error(`parse failed: ${response.status}`);
			showPreview(await response.json());
		} catch {
			showPreview(localFallback(raw));
		}
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (phase !== 'preview' || !pileChoice || !title.trim()) return;
		phase = 'saving';
		const pile = pileChoice.startsWith('new:')
			? { kind: 'new', name: pileChoice.slice(4) }
			: { kind: 'existing', id: pileChoice };
		try {
			const response = await fetch('/api/cards', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ title, notes: notes || null, subtasks, pile })
			});
			if (!response.ok) throw new Error(`save failed: ${response.status}`);
		} catch {
			notice = "Couldn't save — check your connection and try again.";
			phase = 'preview';
			return;
		}
		reset();
		caught = true;
		await onSaved?.();
		textInput?.focus();
	}

	function reset() {
		text = '';
		title = '';
		notes = '';
		subtasks = [];
		pileChoice = '';
		proposedPile = null;
		notice = null;
		phase = 'input';
	}

	function cancel() {
		phase = 'input';
		notice = null;
		queueMicrotask(() => textInput?.focus());
	}

	function submitOnEnter(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			(event.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
		}
	}

	function cancelOnEscape(event: KeyboardEvent) {
		if (event.key === 'Escape') cancel();
	}
</script>

<div class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
	{#if phase === 'input' || phase === 'parsing'}
		<form onsubmit={parse}>
			<label for="capture-text" class="sr-only">Catch a thought</label>
			<textarea
				id="capture-text"
				bind:this={textInput}
				bind:value={text}
				oninput={() => (caught = false)}
				onkeydown={submitOnEnter}
				rows="2"
				maxlength="2000"
				placeholder="Catch a thought…"
				disabled={phase === 'parsing'}
				class="w-full resize-none rounded-md border-stone-300"></textarea>
			<div class="mt-2 flex items-center gap-3">
				<button
					type="submit"
					disabled={phase === 'parsing' || !text.trim()}
					class="rounded-md bg-teal-700 px-4 py-1.5 font-medium text-white hover:bg-teal-800 disabled:opacity-50"
					>{phase === 'parsing' ? 'Sorting…' : 'Catch'}</button
				>
				{#if caught}<span role="status" class="text-sm text-teal-800">Caught ✓</span>{/if}
			</div>
		</form>
	{:else}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<form onsubmit={save} onkeydown={cancelOnEscape} aria-label="Card preview" class="space-y-3">
			<div>
				<label
					for="preview-title"
					class="text-xs font-medium tracking-wide text-stone-500 uppercase">Title</label
				>
				<input
					id="preview-title"
					bind:this={titleInput}
					bind:value={title}
					required
					maxlength="200"
					class="mt-1 w-full rounded-md border-stone-300"
				/>
			</div>
			<div>
				<label for="preview-pile" class="text-xs font-medium tracking-wide text-stone-500 uppercase"
					>Pile</label
				>
				<select
					id="preview-pile"
					bind:value={pileChoice}
					required
					class="mt-1 w-full rounded-md border-stone-300"
				>
					<option value="" disabled>Choose a pile…</option>
					{#if proposedPile}<option value={`new:${proposedPile}`}
							>✨ New pile: {proposedPile}</option
						>{/if}
					{#each piles as pile (pile.id)}<option value={pile.id}>{pile.name}</option>{/each}
				</select>
			</div>
			<div>
				<label
					for="preview-notes"
					class="text-xs font-medium tracking-wide text-stone-500 uppercase">Notes</label
				>
				<textarea
					id="preview-notes"
					bind:value={notes}
					rows="2"
					maxlength="5000"
					class="mt-1 w-full rounded-md border-stone-300"></textarea>
			</div>
			{#if subtasks.length > 0}
				<ul class="space-y-1 text-sm">
					{#each subtasks as subtask, i (i)}
						<li class="flex items-center gap-2">
							<span class="flex-1">☐ {subtask}</span>
							<button
								type="button"
								class="text-stone-500 hover:text-red-700"
								aria-label={`Remove subtask ${subtask}`}
								onclick={() => subtasks.splice(i, 1)}>✕</button
							>
						</li>
					{/each}
				</ul>
			{/if}
			{#if notice}<p role="status" class="text-sm text-amber-800">{notice}</p>{/if}
			<div class="flex gap-2">
				<button
					type="submit"
					disabled={phase === 'saving' || !pileChoice}
					class="rounded-md bg-teal-700 px-4 py-1.5 font-medium text-white hover:bg-teal-800 disabled:opacity-50"
					>{phase === 'saving' ? 'Saving…' : 'Save'}</button
				>
				<button
					type="button"
					onclick={cancel}
					class="rounded-md px-4 py-1.5 text-stone-700 hover:bg-stone-100">Cancel</button
				>
			</div>
		</form>
	{/if}
</div>
