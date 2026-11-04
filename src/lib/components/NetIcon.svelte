<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<!-- The butterfly net: a magnifier-like hoop with a plus, the capture box's mark. -->
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
	<circle cx="9.5" cy="9.5" r="6.5" />
	<path d="M14.5 14.5 21 21" />
	<path d="M5 9.5h9M9.5 5v9" />
</svg>
