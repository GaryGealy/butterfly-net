<script lang="ts">
	let {
		value = $bindable(''),
		name,
		inline = false
	}: { value?: string; name?: string; inline?: boolean } = $props();

	const id = $props.id();
</script>

<div class={inline ? 'flex flex-wrap items-center gap-3' : ''}>
	<label
		for={id}
		class={inline ? 'font-bold text-ink-soft' : 'block text-sm font-bold text-ink-soft'}>Due</label
	>
	<div class="{inline ? '' : 'mt-1'} flex flex-wrap items-center gap-2">
		<input {id} {name} type="date" bind:value class="field w-auto max-w-full rounded-full px-4" />
		{#if value}
			<button type="button" class="btn-soft" onclick={() => (value = '')}>Clear</button>
		{/if}
	</div>
</div>
