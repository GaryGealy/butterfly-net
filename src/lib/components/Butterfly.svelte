<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
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
	<path d="M12 7v12" />
	<path d="M12 9c-2-4-7-5-8-2s2 6 8 6" />
	<path d="M12 9c2-4 7-5 8-2s-2 6-8 6" />
	<path d="M12 13c-2 0-6 1-6 4s4 2 6-1" />
	<path d="M12 13c2 0 6 1 6 4s-4 2-6-1" />
	<path d="M10 7l-1.5-2M14 7l1.5-2" />
</svg>
