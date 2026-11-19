<script lang="ts">
	import type { Priority } from '../priority';

	let {
		priority,
		class: className = ''
	}: { priority: Exclude<Priority, 'medium'>; class?: string } = $props();
</script>

<svg
	class={className}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<path d={priority === 'high' ? 'M7 12.5l5-5 5 5M7 18l5-5 5 5' : 'M7 10l5 5 5-5'} />
</svg>
