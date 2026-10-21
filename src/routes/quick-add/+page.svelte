<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Butterfly from '#lib/components/Butterfly.svelte';
	import CaptureBox from '#lib/components/CaptureBox.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Quick add · Butterfly Net</title></svelte:head>

<div class="mx-auto mt-4 max-w-xl">
	<p class="mb-4 flex items-center justify-center gap-2 font-extrabold text-ink">
		<span class="flex size-8 items-center justify-center rounded-full bg-leaf-tint">
			<Butterfly class="size-5 text-leaf" />
		</span>
		Butterfly Net
	</p>
	<CaptureBox piles={data.piles} onSaved={invalidateAll} autofocus />
	<p class="mt-4 text-center text-sm font-bold">
		<a href={resolve('/')} class="text-muted hover:text-ink">Open your piles →</a>
	</p>
</div>
