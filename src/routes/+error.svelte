<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Butterfly from '#lib/components/Butterfly.svelte';

	const notFound = $derived(page.status === 404);
	const slowDown = $derived(page.status === 429);
	const heading = $derived(
		notFound ? 'This one flew off' : slowDown ? 'Slow down' : 'Something went wrong'
	);
	const title = $derived(notFound ? 'Not found' : slowDown ? 'Slow down' : 'Something went wrong');
	const text = $derived(
		notFound
			? "We couldn't find that page. It may have been moved or deleted."
			: slowDown
				? (page.error?.message ?? '')
				: 'Give it a moment and try again.'
	);
</script>

<svelte:head><title>{title} · Butterfly Net</title></svelte:head>

<div
	class="mx-auto mt-10 max-w-sm rounded-field bg-white p-7 text-center shadow-float"
	data-status={page.status}
>
	<span class="mx-auto flex size-14 items-center justify-center rounded-full bg-leaf-tint">
		<Butterfly class="size-8 text-leaf motion-safe:animate-drift" />
	</span>
	<h1 class="mt-4 text-2xl font-extrabold">{heading}</h1>
	<p class="mt-1 font-bold text-muted">{text}</p>
	<a href={resolve('/')} class="btn-primary mt-6">Back to your piles</a>
</div>
