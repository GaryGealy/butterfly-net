<script lang="ts">
	import { resolve } from '$app/paths';
	import Butterfly from '#lib/components/Butterfly.svelte';
	import IntroDemo from '#lib/components/IntroDemo.svelte';

	let { data } = $props();
	const signupHref = $derived(
		data.invite ? resolve(`/signup?invite=${encodeURIComponent(data.invite)}`) : resolve('/signup')
	);
</script>

<svelte:head><title>Welcome · Butterfly Net</title></svelte:head>

<div class="mx-auto mt-8 max-w-xl">
	<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
		<h1 class="flex flex-wrap items-center gap-3 text-2xl font-extrabold">
			<span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-leaf-tint">
				<Butterfly class="size-7 text-leaf" />
			</span>
			Here's Butterfly Net
		</h1>
		<a
			href={signupHref}
			class="inline-flex min-h-11 items-center font-bold text-muted hover:text-ink"
			>Skip to sign-up</a
		>
	</div>
	<div class="mt-5">
		<IntroDemo>
			{#snippet skip()}
				<a
					href={signupHref}
					class="inline-flex min-h-11 items-center font-bold text-muted hover:text-ink"
					>Go straight to sign-up</a
				>
			{/snippet}
		</IntroDemo>
	</div>
	<a href={signupHref} class="btn-primary mt-6 w-full">Create my account</a>
	<p class="mt-4 text-center text-sm font-bold text-muted">
		Already have an account? <a href={resolve('/login')} class="text-leaf underline">Log in</a>
	</p>
</div>
