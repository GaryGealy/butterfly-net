<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { form } = $props();
</script>

<div class="mx-auto mt-12 max-w-sm">
	<h1 class="mb-6 text-2xl font-semibold">Log in</h1>
	<form method="POST" use:enhance class="space-y-4">
		<div>
			<label for="email" class="block text-sm font-medium">Email</label>
			<input
				id="email"
				name="email"
				type="email"
				autocomplete="email"
				required
				value={form?.email}
				class="mt-1 w-full rounded-md border-stone-300"
			/>
		</div>
		<div>
			<label for="password" class="block text-sm font-medium">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
				class="mt-1 w-full rounded-md border-stone-300"
			/>
		</div>
		{#if form?.error}<p role="alert" class="text-sm text-red-700">{form.error}</p>{/if}
		<button class="w-full rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800"
			>Log in</button
		>
	</form>
	<p class="mt-4 text-sm">
		New here? <a href={resolve('/signup')} class="text-teal-800 underline">Create an account</a>
	</p>
</div>
