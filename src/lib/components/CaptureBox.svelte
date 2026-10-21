<script lang="ts">
	import type { ParseResult, PileRef } from '../types.ts';
	import { NEW_PILE_COLOR, NO_PILE_COLOR, pileColor } from '../pile-color';
	import Butterfly from './Butterfly.svelte';

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
	let lastPile = $state('');
	let textInput = $state<HTMLTextAreaElement>();
	let titleInput = $state<HTMLInputElement>();

	const chosenName = $derived(
		pileChoice.startsWith('new:')
			? pileChoice.slice(4)
			: (piles.find((p) => p.id === pileChoice)?.name ?? '')
	);
	// The preview wears its pile's colour, so changing the pile recolours it.
	const previewColor = $derived(
		pileChoice.startsWith('new:')
			? NEW_PILE_COLOR
			: pileChoice
				? pileColor(piles.findIndex((p) => p.id === pileChoice))
				: NO_PILE_COLOR
	);

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
				body: JSON.stringify({
					title,
					notes: notes || null,
					subtasks: subtasks.map((t) => t.trim()).filter(Boolean),
					pile
				})
			});
			if (!response.ok) throw new Error(`save failed: ${response.status}`);
		} catch {
			notice = "Couldn't save — check your connection and try again.";
			phase = 'preview';
			return;
		}
		lastPile = chosenName;
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
		if (phase === 'saving') return;
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

{#if phase === 'input' || phase === 'parsing'}
	<form
		onsubmit={parse}
		class="flex items-start gap-3 rounded-field bg-white p-3 pl-5 shadow-float"
	>
		<svg
			class="mt-3 size-6 shrink-0 text-leaf"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<circle cx="9.5" cy="9.5" r="6.5" />
			<path d="M14.5 14.5 21 21" />
			<path d="M5 9.5h9M9.5 5v9" />
		</svg>
		<label for="capture-text" class="sr-only">Catch a thought</label>
		<textarea
			id="capture-text"
			bind:this={textInput}
			bind:value={text}
			oninput={() => (caught = false)}
			onkeydown={submitOnEnter}
			rows="2"
			maxlength="2000"
			placeholder="What's fluttering around?"
			disabled={phase === 'parsing'}
			class="min-w-0 flex-1 resize-none border-0 bg-transparent px-0 py-2 text-lg font-semibold placeholder:font-medium placeholder:text-muted focus:ring-0"
		></textarea>
		<button
			type="submit"
			disabled={phase === 'parsing' || !text.trim()}
			class="btn-primary shrink-0 self-center">{phase === 'parsing' ? 'Sorting…' : 'Catch'}</button
		>
	</form>
	<p class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-5 text-sm font-bold text-muted">
		<span>Press Enter to catch</span>
		{#if caught}<span role="status" class="text-leaf">Caught ✓ It landed on {lastPile}.</span>{/if}
	</p>
{:else}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<form
		onsubmit={save}
		onkeydown={cancelOnEscape}
		aria-label="Card preview"
		class="space-y-4 rounded-field p-5 transition-colors duration-300 {previewColor}"
	>
		<p class="flex items-start gap-2 text-sm font-bold text-ink-soft">
			<Butterfly class="mt-0.5 size-4.5 shrink-0" />
			{#if notice}
				<span role="status" class="text-amber-900">{notice}</span>
			{:else}
				<span
					>Claude thinks this belongs on <strong class="font-extrabold text-ink"
						>{chosenName}</strong
					>. Edit anything, then save.</span
				>
			{/if}
		</p>
		<div class="chip space-y-2 px-5 py-4">
			<label for="preview-title" class="sr-only">Title</label>
			<input
				id="preview-title"
				bind:this={titleInput}
				bind:value={title}
				required
				maxlength="200"
				class="w-full border-0 bg-transparent p-0 text-xl leading-snug font-extrabold focus:ring-0"
			/>
			<label for="preview-notes" class="sr-only">Notes</label>
			<textarea
				id="preview-notes"
				bind:value={notes}
				rows="2"
				maxlength="5000"
				placeholder="Notes"
				class="w-full resize-none border-0 bg-transparent p-0 font-semibold text-ink-soft placeholder:font-medium placeholder:text-muted focus:ring-0"
			></textarea>
			{#if subtasks.length > 0}
				<ul class="space-y-1 border-t border-line pt-2">
					{#each subtasks, i (i)}
						<li class="flex items-center gap-2">
							<span aria-hidden="true" class="size-4 shrink-0 rounded-full border-2 border-muted"
							></span>
							<input
								bind:value={subtasks[i]}
								maxlength="200"
								aria-label={`Subtask ${i + 1}`}
								class="flex-1 border-0 bg-transparent p-0 text-sm font-semibold focus:ring-0"
							/>
							<button
								type="button"
								class="flex size-9 items-center justify-center rounded-full text-muted hover:bg-line hover:text-red-700"
								aria-label={`Remove subtask ${i + 1}`}
								onclick={() => subtasks.splice(i, 1)}>✕</button
							>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
		<div class="flex flex-wrap items-center gap-3">
			<label for="preview-pile" class="font-bold text-ink-soft">Pile</label>
			<select
				id="preview-pile"
				bind:value={pileChoice}
				required
				class="field w-auto rounded-full py-2 pr-10 pl-4 font-bold"
			>
				<option value="" disabled>Choose a pile…</option>
				{#if proposedPile}<option value={`new:${proposedPile}`}>New pile: {proposedPile}</option
					>{/if}
				{#each piles as pile (pile.id)}<option value={pile.id}>{pile.name}</option>{/each}
			</select>
		</div>
		<div class="flex flex-wrap gap-2">
			<button type="submit" disabled={phase === 'saving' || !pileChoice} class="btn-primary"
				>{phase === 'saving' ? 'Saving…' : 'Save'}</button
			>
			<button type="button" onclick={cancel} disabled={phase === 'saving'} class="btn-quiet"
				>Cancel</button
			>
		</div>
	</form>
{/if}
