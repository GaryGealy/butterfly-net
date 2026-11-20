<script lang="ts">
	import { dueLabel, type DueTone } from '../due';

	let { dueOn, today }: { dueOn: string; today: string } = $props();

	const label = $derived(dueLabel(dueOn, today));

	const TONE: Record<DueTone, string> = {
		overdue: 'bg-red-50 text-red-800',
		today: 'bg-leaf-tint text-leaf-dark',
		plain: 'bg-white/75 text-ink-soft ring-1 ring-line'
	};
</script>

<span
	title={label.title}
	class="inline-flex max-w-full min-w-0 items-center gap-0.5 rounded-full py-px pr-2 pl-1.5 text-[0.8125rem] font-extrabold [overflow-wrap:anywhere] {TONE[
		label.tone
	]}"
>
	<svg class="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<rect x="4" y="5.5" width="16" height="14.5" rx="3" stroke="currentColor" stroke-width="2" />
		<path
			d="M4 10h16M8.5 3.5v4M15.5 3.5v4"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
		/>
	</svg>
	<span aria-hidden="true" class="min-w-0">{label.text}</span><span class="sr-only"
		>, {label.spoken}</span
	>
</span>
