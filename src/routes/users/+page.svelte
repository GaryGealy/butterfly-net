<script lang="ts">
	let { data } = $props();

	// UTC, so the server and the browser render the same text.
	const signedUp = (date: Date) =>
		date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			timeZone: 'UTC',
			timeZoneName: 'short'
		});

	const howTheyGotIn = (user: (typeof data.users)[number]) =>
		user.joinedWith === 'invite'
			? `Invite from ${user.invitedBy ?? 'a deleted account'}`
			: user.joinedWith === 'company'
				? 'Company email'
				: 'No invite';
</script>

<svelte:head><title>Users · Butterfly Net</title></svelte:head>

<h1 class="text-2xl font-extrabold">Users</h1>
<p class="mt-1 font-bold text-muted">
	{data.users.length}
	{data.users.length === 1 ? 'person has' : 'people have'} signed up
</p>

<ul class="mt-5 max-w-2xl space-y-2">
	{#each data.users as user (user.id)}
		<li class="chip flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
			<span class="min-w-0 flex-1 font-bold [overflow-wrap:anywhere]">{user.email}</span>
			{#if user.isAdmin}
				<span class="rounded-full bg-leaf-tint px-2 py-0.5 text-sm font-bold text-leaf">Admin</span>
			{/if}
			<span class="w-full text-sm font-bold text-muted">
				{signedUp(user.created_at)} · {howTheyGotIn(user)}
			</span>
		</li>
	{/each}
</ul>
