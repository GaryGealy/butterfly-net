<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Butterfly from '#lib/components/Butterfly.svelte';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head
	><title>{notFound ? 'Not found' : 'Something went wrong'} · Butterfly Net</title></svelte:head
>

<div class="mx-auto mt-10 max-w-sm rounded-field bg-white p-7 text-center shadow-float">
	<span class="mx-auto flex size-14 items-center justify-center rounded-full bg-leaf-tint">
		<Butterfly class="size-8 text-leaf motion-safe:animate-drift" />
	</span>
	<h1 class="mt-4 text-2xl font-extrabold">
		{notFound ? 'This one flew off' : 'Something went wrong'}
	</h1>
	<p class="mt-1 font-bold text-muted">
		{notFound
			? "We couldn't find that page. It may have been moved or deleted."
			: 'Give it a moment and try again.'}
	</p>
	<p class="mt-2 text-sm font-bold text-muted">Error {page.status}</p>
	<a href={resolve('/')} class="btn-primary mt-6">Back to your piles</a>
</div>
