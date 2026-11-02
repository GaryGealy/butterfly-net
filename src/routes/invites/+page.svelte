<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let copied = $state<string | null>(null);

	async function copy(link: string) {
		await navigator.clipboard.writeText(link);
		copied = link;
		setTimeout(() => (copied = copied === link ? null : copied), 2000);
	}

	const linkFor = (code: string) => `${data.origin}/signup?invite=${code}`;
	const day = (date: Date) =>
		date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
</script>

<svelte:head><title>Invites · Butterfly Net</title></svelte:head>

<h1 class="text-2xl font-extrabold">Invites</h1>
<p class="mt-1 font-bold text-muted">
	Each link lets one person create an account. Links expire after 14 days.
</p>

<form method="POST" action="?/create" use:enhance class="mt-5">
	<button class="btn-primary">Create invite link</button>
</form>

{#if form?.created}
	{@const created = form.created}
	<div class="chip mt-4 flex max-w-2xl items-center gap-2 p-2 pl-4">
		<label for="new-invite" class="sr-only">New invite link</label>
		<input
			id="new-invite"
			readonly
			value={created}
			class="min-w-0 flex-1 border-0 bg-transparent p-0 font-semibold focus:ring-0"
		/>
		<button type="button" class="btn-secondary shrink-0" onclick={() => copy(created)}
			>{copied === created ? 'Copied' : 'Copy'}</button
		>
	</div>
{/if}

<section aria-labelledby="unused-heading" class="mt-8 max-w-2xl">
	<h2 id="unused-heading" class="text-lg font-extrabold">Unused</h2>
	{#if data.unused.length === 0}
		<p class="mt-2 font-bold text-muted">No open invite links.</p>
	{:else}
		<ul class="mt-2 space-y-2">
			{#each data.unused as invite (invite.id)}
				<li class="chip flex flex-wrap items-center gap-2 py-2 pr-2 pl-4">
					<span class="min-w-0 flex-1 truncate font-mono text-sm">{invite.code}</span>
					<span class="text-sm font-bold text-muted">expires {day(invite.expires_at)}</span>
					<button type="button" class="btn-quiet" onclick={() => copy(linkFor(invite.code))}
						>{copied === linkFor(invite.code) ? 'Copied' : 'Copy'}</button
					>
					<form method="POST" action="?/revoke" use:enhance>
						<input type="hidden" name="id" value={invite.id} />
						<button class="btn-danger">Revoke</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section aria-labelledby="used-heading" class="mt-8 max-w-2xl">
	<h2 id="used-heading" class="text-lg font-extrabold">Used</h2>
	{#if data.used.length === 0}
		<p class="mt-2 font-bold text-muted">Nobody has joined through an invite yet.</p>
	{:else}
		<ul class="mt-2 space-y-2">
			{#each data.used as invite (invite.id)}
				<li class="chip flex items-center justify-between gap-2 px-4 py-2">
					<span class="font-bold">{invite.email ?? 'Unknown account'}</span>
					<span class="text-sm font-bold text-muted">joined {day(invite.used_at)}</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>
