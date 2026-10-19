<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CaptureBox from '#lib/components/CaptureBox.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Quick add · butterfly-net</title></svelte:head>

<div class="mx-auto max-w-xl">
	<CaptureBox piles={data.piles} onSaved={invalidateAll} autofocus />
	<p class="mt-3 text-center text-sm">
		<a href={resolve('/')} class="text-stone-500 hover:text-stone-800">Open your piles →</a>
	</p>
</div>
