<script lang="ts">
	import { deltaLabel } from '$lib/scores';

	export let rank: number | null;
	export let delta: number | null = null;
	export let previousRank: number | null = null;
	export let wonCoffee: boolean | null | undefined = false;
	/** Why identical predictions didn't land on the same rank, if they tied. */
	export let tiebreak: string | null = null;

	function getRankDisplay(rank: number | null): string {
		if (rank === null) return '-';
		if (rank === 1) return '🥇 1st';
		if (rank === 2) return '🥈 2nd';
		if (rank === 3) return '🥉 3rd';

		const suffix = getRankSuffix(rank);
		return `${rank}${suffix}`;
	}

	function getRankSuffix(rank: number): string {
		const lastDigit = rank % 10;
		const lastTwoDigits = rank % 100;

		if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
			return 'th';
		}

		switch (lastDigit) {
			case 1:
				return 'st';
			case 2:
				return 'nd';
			case 3:
				return 'rd';
			default:
				return 'th';
		}
	}

	function getRankDelta(): string | null {
		if (previousRank === null || rank === null) return null;
		const change = previousRank - rank;
		if (change > 0) return `+${change}`;
		if (change < 0) return `${change}`;
		return null;
	}

	function getDeltaDisplay(delta: number | null): string {
		return deltaLabel(delta);
	}

	$: rankDelta = getRankDelta();
</script>

<div class="flex items-center gap-2">
	<span
		class="text-lg font-bold"
		class:text-yellow-600={rank === 1}
		class:text-gray-400={rank === 2}
		class:text-orange-600={rank === 3}
	>
		{getRankDisplay(rank)}
	</span>

	{#if tiebreak}
		<span
			class="inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-400 dark:border-gray-500 text-[10px] font-bold text-gray-500 dark:text-gray-400 cursor-help"
			title={tiebreak}
			aria-label={tiebreak}
		>
			?
		</span>
	{/if}

	{#if rankDelta}
		<span class="text-sm" class:text-green-600={rankDelta.startsWith('+')} class:text-red-600={rankDelta.startsWith('-')}>
			{rankDelta}
		</span>
	{/if}

	{#if wonCoffee}
		<!-- Cup only: the label was the widest thing in the row, and the row's own
		     highlight plus the "Winner" callout in the game header already say it. -->
		<span
			class="text-sm cursor-help"
			role="img"
			title="Coffee Winner"
			aria-label="Coffee Winner"
		>
			☕
		</span>
	{/if}

	{#if delta !== null}
		<span class="text-sm text-gray-600 dark:text-gray-400">
			{getDeltaDisplay(delta)}
		</span>
	{/if}
</div>
