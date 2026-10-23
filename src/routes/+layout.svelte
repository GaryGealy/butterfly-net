<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Butterfly from '#lib/components/Butterfly.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Lets e2e tests wait until hydration is done before touching the page.
	onMount(() => {
		document.documentElement.dataset.hydrated = '';
	});

	const links: { href: '/' | '/search' | '/archive' | '/piles'; label: string }[] = [
		{ href: '/', label: 'Piles' },
		{ href: '/search', label: 'Search' },
		{ href: '/archive', label: 'Archive' },
		{ href: '/piles', label: 'Manage piles' }
	];
</script>

<svelte:head>
	<title>Butterfly Net</title>
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/icons/icon-192.png" />
	<meta name="theme-color" content="#2f6b4f" />
</svelte:head>

{#if data.user && page.url.pathname !== '/quick-add'}
	<header class="px-4 pt-5 pb-2 sm:px-8">
		<nav class="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2">
			<a href={resolve('/')} class="flex items-center gap-2.5 text-xl font-extrabold text-ink">
				<span
					class="flex size-10 items-center justify-center rounded-full bg-leaf-tint motion-safe:animate-drift"
				>
					<Butterfly class="size-6 text-leaf" />
				</span>
				Butterfly Net
			</a>
			<div class="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2">
				{#each links as link (link.href)}
					<a
						href={resolve(link.href)}
						class="font-bold text-muted hover:text-ink aria-[current=page]:text-ink"
						aria-current={page.url.pathname === link.href ? 'page' : undefined}>{link.label}</a
					>
				{/each}
				<div class="flex min-w-0 items-center gap-3">
					<span
						title={data.user.email}
						class="max-w-64 truncate rounded-full bg-white px-3 py-1 text-sm font-semibold text-muted shadow-chip"
						><span class="sr-only">Signed in as</span> {data.user.email}</span
					>
					<form method="POST" action="/logout">
						<button class="font-bold text-muted hover:text-ink">Log out</button>
					</form>
				</div>
			</div>
		</nav>
	</header>
{/if}

<main class="mx-auto max-w-5xl px-4 py-6 sm:px-8">
	{@render children()}
</main>
