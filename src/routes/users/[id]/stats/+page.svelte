<script lang="ts">
	import type { PageData } from './$types';
	import UserAvatar from '$lib/components/UserAvatar.svelte';
	import RankBadge from '$lib/components/RankBadge.svelte';

	export let data: PageData;

	function formatDate(date: Date) {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>{data.user.name} - Stats | Predictions</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Back Button -->
	<div class="mb-6">
		<a
			href="/"
			class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-2"
		>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 19l-7-7m0 0l7-7m-7 7h18"
				/>
			</svg>
			Back to Leaderboard
		</a>
	</div>

	<!-- User Header -->
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-200 dark:border-gray-700">
		<div class="flex items-center gap-6">
			<UserAvatar name={data.user.name} mugshotUrl={data.user.mugshotUrl} size="lg" />
			<div>
				<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
					{data.user.name}
				</h1>
				{#if data.user.nickname}
					<p class="text-lg text-gray-600 dark:text-gray-400">"{data.user.nickname}"</p>
				{/if}
				{#if data.membership.betting}
					<span class="inline-flex items-center px-3 py-1 mt-2 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
						☕ Coffee Better
					</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Stats Overview -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
			<div class="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
				{data.stats.coffeeWins}
			</div>
			<div class="text-sm text-gray-600 dark:text-gray-400">Coffee Wins</div>
		</div>

		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
			<div class="text-3xl font-bold text-gray-900 dark:text-gray-100">
				{data.stats.totalPredictions}
			</div>
			<div class="text-sm text-gray-600 dark:text-gray-400">Total Predictions</div>
		</div>

		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
			<div class="text-3xl font-bold text-gray-900 dark:text-gray-100">
				{data.stats.firstPlace}
			</div>
			<div class="text-sm text-gray-600 dark:text-gray-400">1st Place Finishes</div>
		</div>

		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
			<div class="text-3xl font-bold text-gray-900 dark:text-gray-100">
				{#if data.stats.avgDelta !== null}
					{data.stats.avgDelta.toFixed(1)}
				{:else}
					-
				{/if}
			</div>
			<div class="text-sm text-gray-600 dark:text-gray-400">Avg Points Off</div>
		</div>
	</div>

	<!-- Additional Stats -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
			<div class="text-sm text-gray-600 dark:text-gray-400 mb-1">Top 3 Finishes</div>
			<div class="text-2xl font-bold text-gray-900 dark:text-gray-100">
				{data.stats.topThree}
			</div>
		</div>

		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
			<div class="text-sm text-gray-600 dark:text-gray-400 mb-1">Perfect Predictions</div>
			<div class="text-2xl font-bold text-gray-900 dark:text-gray-100">
				{data.stats.perfectPredictions}
			</div>
		</div>

		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
			<div class="text-sm text-gray-600 dark:text-gray-400 mb-1">Best / Worst Delta</div>
			<div class="text-2xl font-bold text-gray-900 dark:text-gray-100">
				{#if data.stats.bestDelta !== null && data.stats.worstDelta !== null}
					{data.stats.bestDelta} / {data.stats.worstDelta}
				{:else}
					-
				{/if}
			</div>
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
		<!-- Best Predictions -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
			<h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
				🎯 Best Predictions
			</h2>
			{#if data.bestPredictions.length > 0}
				<div class="space-y-3">
					{#each data.bestPredictions as { prediction, game }}
						<div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
							<div class="flex items-center justify-between mb-2">
								<div class="font-semibold text-gray-900 dark:text-gray-100">
									{game.homeTeam} vs {game.awayTeam}
								</div>
								<RankBadge rank={prediction.rank} delta={prediction.delta} />
							</div>
							<div class="text-sm text-gray-600 dark:text-gray-400">
								<span class="font-medium">Predicted:</span>
								{prediction.homeScore}-{prediction.awayScore} •
								<span class="font-medium">Actual:</span>
								{game.homeScore}-{game.awayScore}
							</div>
							<div class="text-xs text-gray-500 dark:text-gray-500 mt-1">
								{formatDate(game.gameTime)}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-gray-500 dark:text-gray-400 text-center py-4">No predictions yet</p>
			{/if}
		</div>

		<!-- Worst Predictions -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
			<h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
				😅 Learning Experiences
			</h2>
			{#if data.worstPredictions.length > 0}
				<div class="space-y-3">
					{#each data.worstPredictions as { prediction, game }}
						<div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
							<div class="flex items-center justify-between mb-2">
								<div class="font-semibold text-gray-900 dark:text-gray-100">
									{game.homeTeam} vs {game.awayTeam}
								</div>
								<RankBadge rank={prediction.rank} delta={prediction.delta} />
							</div>
							<div class="text-sm text-gray-600 dark:text-gray-400">
								<span class="font-medium">Predicted:</span>
								{prediction.homeScore}-{prediction.awayScore} •
								<span class="font-medium">Actual:</span>
								{game.homeScore}-{game.awayScore}
							</div>
							<div class="text-xs text-gray-500 dark:text-gray-500 mt-1">
								{formatDate(game.gameTime)}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-gray-500 dark:text-gray-400 text-center py-4">No predictions yet</p>
			{/if}
		</div>
	</div>

	<!-- All Predictions -->
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
		<h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
			All Predictions ({data.predictions.length})
		</h2>
		{#if data.predictions.length > 0}
			<div class="space-y-2">
				{#each data.predictions as { prediction, game }}
					<div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
						<div class="flex items-center justify-between">
							<div class="flex-1">
								<div class="font-semibold text-gray-900 dark:text-gray-100">
									{game.homeTeam} vs {game.awayTeam}
								</div>
								<div class="text-sm text-gray-600 dark:text-gray-400">
									<span class="font-medium">Predicted:</span>
									{prediction.homeScore}-{prediction.awayScore}
									{#if game.status === 'finished' && game.homeScore !== null && game.awayScore !== null}
										• <span class="font-medium">Actual:</span>
										{game.homeScore}-{game.awayScore}
									{/if}
								</div>
								<div class="text-xs text-gray-500 dark:text-gray-500 mt-1">
									{formatDate(game.gameTime)}
								</div>
							</div>
							<div class="ml-4">
								{#if game.status === 'finished'}
									<RankBadge
										rank={prediction.rank}
										delta={prediction.delta}
										wonCoffee={prediction.wonCoffee}
									/>
								{:else if game.status === 'live'}
									<span class="text-sm text-green-600 dark:text-green-400 font-medium">
										Live
									</span>
								{:else}
									<span class="text-sm text-gray-500 dark:text-gray-400">Upcoming</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-gray-500 dark:text-gray-400 text-center py-8">
				No predictions for this season yet
			</p>
		{/if}
	</div>
</div>
