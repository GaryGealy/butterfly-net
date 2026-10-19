<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Lets e2e tests wait until hydration is done before touching the page.
	onMount(() => {
		document.documentElement.dataset.hydrated = '';
	});

	const links = [
		{ href: '/', label: 'Piles' },
		{ href: '/search', label: 'Search' },
		{ href: '/archive', label: 'Archive' },
		{ href: '/piles', label: 'Manage piles' }
	];
</script>

<svelte:head>
	<title>butterfly-net</title>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if data.user && page.url.pathname !== '/quick-add'}
	<header class="border-b border-stone-200 bg-white">
		<nav class="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
			<a href={resolve('/')} class="font-semibold text-teal-800">🦋 butterfly-net</a>
			{#each links as link (link.href)}
				<a
					href={resolve(link.href as '/')}
					class="text-sm text-stone-600 hover:text-stone-900 aria-[current=page]:font-semibold aria-[current=page]:text-stone-900"
					aria-current={page.url.pathname === link.href ? 'page' : undefined}>{link.label}</a
				>
			{/each}
			<form method="POST" action="/logout" class="ml-auto">
				<button class="text-sm text-stone-600 hover:text-stone-900">Log out</button>
			</form>
		</nav>
	</header>
{/if}

<main class="mx-auto max-w-5xl px-4 py-6">
	{@render children()}
</main>
