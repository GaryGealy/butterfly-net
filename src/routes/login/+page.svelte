<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Butterfly from '#lib/components/Butterfly.svelte';
	import { MAX_EMAIL_LENGTH } from '#lib/limits.ts';

	let { form } = $props();
</script>

<svelte:head><title>Log in · Butterfly Net</title></svelte:head>

<div class="mx-auto mt-10 max-w-sm rounded-field bg-white p-7 shadow-float">
	<span class="flex size-12 items-center justify-center rounded-full bg-leaf-tint">
		<Butterfly class="size-7 text-leaf" />
	</span>
	<h1 class="mt-4 text-2xl font-extrabold">Welcome back</h1>
	<p class="mb-6 font-bold text-muted">Your piles are where you left them.</p>
	<form method="POST" use:enhance class="space-y-4">
		<div>
			<label for="email" class="block text-sm font-bold text-ink-soft">Email</label>
			<input
				id="email"
				name="email"
				type="email"
				maxlength={MAX_EMAIL_LENGTH}
				autocomplete="email"
				required
				value={form?.email}
				class="field mt-1"
			/>
		</div>
		<div>
			<label for="password" class="block text-sm font-bold text-ink-soft">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
				class="field mt-1"
			/>
		</div>
		{#if form?.error}<p role="alert" class="text-sm font-bold text-red-700">{form.error}</p>{/if}
		<button class="btn-primary w-full">Log in</button>
	</form>
	<p class="mt-5 text-sm font-bold text-muted">
		New here? <a href={resolve('/signup')} class="text-leaf underline">Create an account</a>
	</p>
</div>
