<script lang="ts">
	import { DEFAULT_PRIORITY, PRIORITIES, PRIORITY_LABEL, type Priority } from '../priority';
	import PriorityIcon from './PriorityIcon.svelte';

	let {
		value = $bindable(DEFAULT_PRIORITY),
		inline = false
	}: { value?: Priority; inline?: boolean } = $props();
</script>

<fieldset class="min-w-0">
	<legend
		class={inline
			? 'float-left mr-3 leading-11 font-bold text-ink-soft'
			: 'block text-sm font-bold text-ink-soft'}>Priority</legend
	>
	<span
		class="{inline
			? ''
			: 'mt-1'} inline-flex max-w-full flex-wrap rounded-3xl border border-line bg-white p-[3px] shadow-chip"
	>
		{#each PRIORITIES as priority (priority)}
			<label
				class="group relative inline-flex min-h-[38px] cursor-pointer items-center gap-0.5 rounded-full px-2 text-sm font-bold text-ink-soft has-checked:bg-leaf has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-leaf"
			>
				<input type="radio" name="priority" value={priority} bind:group={value} class="sr-only" />
				{#if priority !== 'medium'}
					<PriorityIcon
						{priority}
						class="size-4 group-has-checked:text-white {priority === 'high'
							? 'text-red-700'
							: 'text-muted'}"
					/>
				{/if}
				{PRIORITY_LABEL[priority]}
			</label>
		{/each}
	</span>
</fieldset>
