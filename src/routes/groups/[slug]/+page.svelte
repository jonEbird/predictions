<script lang="ts">
	import type { PageData } from './$types';
	import GameCard from '$lib/components/GameCard.svelte';
	import UserAvatar from '$lib/components/UserAvatar.svelte';

	export let data: PageData;

	function changeSeason(season: number) {
		window.location.href = `/groups/${data.group.slug}?season=${season}`;
	}

	// Separate recent seasons for breadcrumbs vs older seasons for dropdown
	const maxVisibleSeasons = 5;
	$: recentSeasons = data.availableSeasons.slice(0, maxVisibleSeasons);
	$: olderSeasons = data.availableSeasons.slice(maxVisibleSeasons);

	// Separate games by status and time
	$: upcomingGames = data.games.filter((g) => {
		const gameTime = new Date(g.game.gameTime);
		const now = new Date();
		return g.game.status === 'scheduled' && gameTime > now;
	});

	$: liveGames = data.games.filter((g) => g.game.status === 'live');

	$: finishedGames = data.games.filter((g) => {
		const gameTime = new Date(g.game.gameTime);
		const now = new Date();
		// Include games that are finished OR scheduled games that have passed
		return g.game.status === 'finished' || (g.game.status === 'scheduled' && gameTime <= now);
	});

	// Theme colors from group
	$: primaryColor = data.group.primaryColor || '#BB0000';
	$: accentColor = data.group.accentColor || '#666666';
</script>

<svelte:head>
	<title>{data.group.name} - {data.currentSeason} | Predictions</title>
	<style>
		:root {
			--theme-primary: {primaryColor};
			--theme-accent: {accentColor};
		}
	</style>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Header with Gradient Background -->
	<div class="mb-8 rounded-xl p-6 shadow-lg" style="background: linear-gradient(135deg, {primaryColor}15 0%, {accentColor}10 100%);">
		<!-- Season Navigation -->
		{#if data.availableSeasons.length > 1}
			<div class="mb-6 flex items-center gap-2 flex-wrap">
				<span class="text-sm font-medium" style="color: {accentColor};">Seasons:</span>
				{#each recentSeasons as season}
					<button
						on:click={() => changeSeason(season)}
						class="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm {season === data.currentSeason
							? 'text-white transform scale-105 shadow-md'
							: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:shadow-md hover:scale-105'}"
						style={season === data.currentSeason ? `background-color: ${primaryColor};` : ''}
					>
						{season}
					</button>
				{/each}

				{#if olderSeasons.length > 0}
					<div class="relative inline-block">
						<select
							on:change={(e) => changeSeason(parseInt(e.currentTarget.value))}
							class="px-4 py-2 border-2 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:shadow-md cursor-pointer transition-all duration-200"
							style="border-color: {accentColor}50;"
						>
							<option value="">Older Seasons</option>
							{#each olderSeasons as season}
								<option value={season}>{season}</option>
							{/each}
						</select>
					</div>
				{/if}
			</div>
		{/if}

		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2" style="color: {primaryColor};">
					{data.currentSeason} Season
				</h1>

				{#if data.group.description}
					<p class="text-lg text-gray-600 dark:text-gray-400">
						{data.group.description}
					</p>
				{/if}
			</div>

			{#if data.group.pictureUrl}
				<img
					src={data.group.pictureUrl}
					alt={data.group.name}
					class="w-28 h-28 object-cover rounded-xl shadow-lg ring-4 ring-white dark:ring-gray-800"
				/>
			{/if}
		</div>
	</div>

	<!-- Stats Preview Card -->
	{#if data.statsPreview.currentLeader}
		<div class="mb-8 bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg p-6 border-2 border-blue-200 dark:border-blue-800">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">📊 Season Stats</h2>
				<a
					href="/seasons/{data.currentSeason}/insights?groupId={data.group.id}"
					class="text-sm font-semibold px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105 shadow-sm"
					style="background-color: {primaryColor}; color: white;"
				>
					View Full Insights →
				</a>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<!-- Current Leader -->
				<div class="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
					<div class="text-sm text-gray-600 dark:text-gray-400 mb-1">🏆 Current Leader</div>
					<div class="font-bold text-lg text-gray-900 dark:text-gray-100">
						{data.statsPreview.currentLeader.user.name}
					</div>
					{#if data.statsPreview.currentLeader.avgDelta !== null}
						<div class="text-sm" style="color: {accentColor};">
							{data.statsPreview.currentLeader.avgDelta.toFixed(1)} avg delta
						</div>
					{/if}
				</div>

				<!-- Your Position -->
				{#if data.statsPreview.userPosition > 0}
					<div class="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
						<div class="text-sm text-gray-600 dark:text-gray-400 mb-1">📍 Your Position</div>
						<div class="font-bold text-lg text-gray-900 dark:text-gray-100">
							#{data.statsPreview.userPosition} of {data.statsPreview.totalPlayers}
						</div>
						<div class="text-sm text-gray-600 dark:text-gray-400">
							{data.statsPreview.userPosition === 1 ? "You're winning!" :
							 data.statsPreview.userPosition <= 3 ? "On the podium!" :
							 "Keep predicting!"}
						</div>
					</div>
				{/if}

				<!-- Coffee Leader -->
				{#if data.statsPreview.coffeeLeader}
					<div class="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
						<div class="text-sm text-gray-600 dark:text-gray-400 mb-1">☕ Most Coffee Won</div>
						<div class="font-bold text-lg text-gray-900 dark:text-gray-100">
							{data.statsPreview.coffeeLeader.user.name}
						</div>
						<div class="text-sm" style="color: {accentColor};">
							{data.statsPreview.coffeeLeader.coffeeWins} wins
						</div>
					</div>
				{/if}

				<!-- Top 3 Quick View -->
				<div class="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
					<div class="text-sm text-gray-600 dark:text-gray-400 mb-2">🥇 Top 3</div>
					<div class="space-y-1">
						{#each data.leaderboard.slice(0, 3) as entry, index}
							<div class="text-sm flex items-center justify-between">
								<span class="text-gray-900 dark:text-gray-100">
									{index + 1}. {entry.user.name}
								</span>
								<span class="text-gray-600 dark:text-gray-400">
									{entry.coffeeWins} ☕
								</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Upcoming & Live Games Section -->
	<div class="space-y-8 mb-8">
		<!-- Live Games -->
		{#if liveGames.length > 0}
			<div>
				<h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Live Games</h2>
				<div class="grid gap-6 md:grid-cols-2">
					{#each liveGames as { game, predictionCount, winners }}
						<GameCard
							{game}
							{predictionCount}
							{winners}
							{accentColor}
							href="/games/{game.id}?groupId={data.group.id}"
						/>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Upcoming Games -->
		{#if upcomingGames.length > 0}
			<div>
				<h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
					Upcoming Games
				</h2>
				<div class="grid gap-6 md:grid-cols-2">
					{#each upcomingGames as { game, predictionCount, winners }}
						<GameCard
							{game}
							{predictionCount}
							{winners}
							{accentColor}
							href="/games/{game.id}?groupId={data.group.id}"
						/>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- Leaderboard Section -->
	{#if data.leaderboard.length > 0}
		<div class="mb-8 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
			<h2 class="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">Season Standings</h2>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
				<!-- Top 3 Podium -->
				{#each data.leaderboard.slice(0, 3) as entry, index}
					<a
						href="/users/{entry.user.id}/stats?groupId={data.group.id}"
						class="text-center p-6 rounded-xl transition-all duration-300 hover:scale-105 shadow-md hover:shadow-xl {index === 0
							? 'ring-2'
							: 'bg-white dark:bg-gray-800'}"
						style={index === 0 ? `background: linear-gradient(135deg, ${primaryColor}15 0%, ${accentColor}10 100%); ring-color: ${accentColor};` : ''}
					>
						<div class="flex justify-center mb-3">
							<UserAvatar name={entry.user.name} mugshotUrl={entry.user.mugshotUrl} size="lg" />
						</div>
						<div class="text-4xl mb-2">
							{#if index === 0}🥇{:else if index === 1}🥈{:else}🥉{/if}
						</div>
						<div class="font-bold text-lg text-gray-900 dark:text-gray-100">
							{entry.user.name}
						</div>
						{#if entry.user.nickname}
							<div class="text-sm text-gray-500 dark:text-gray-400 mb-2">
								"{entry.user.nickname}"
							</div>
						{/if}
						<div class="mt-3 space-y-1">
							<div class="text-2xl font-bold" style="color: {index === 0 ? accentColor : '#D97706'};">
								{entry.coffeeWins} ☕
							</div>
							<div class="text-sm text-gray-600 dark:text-gray-400">
								{entry.totalPredictions} predictions
							</div>
							{#if entry.avgDelta !== null}
								<div class="text-sm text-gray-600 dark:text-gray-400">
									Avg: {entry.avgDelta.toFixed(1)} off
								</div>
							{/if}
						</div>
					</a>
				{/each}
			</div>

			<!-- Rest of Standings -->
			{#if data.leaderboard.length > 3}
				<div class="mt-8 pt-8 border-t-2 border-gray-200 dark:border-gray-700">
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{#each data.leaderboard.slice(3) as entry, index}
							<a
								href="/users/{entry.user.id}/stats?groupId={data.group.id}"
								class="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl hover:shadow-md transition-all duration-200 hover:scale-102 border border-gray-100 dark:border-gray-700"
							>
								<div class="text-xl font-bold text-gray-400 dark:text-gray-500 w-10 text-center">
									#{index + 4}
								</div>
								<UserAvatar name={entry.user.name} mugshotUrl={entry.user.mugshotUrl} size="sm" />
								<div class="flex-1 min-w-0">
									<div class="font-semibold text-gray-900 dark:text-gray-100 truncate">
										{entry.user.name}
									</div>
									<div class="text-sm text-gray-600 dark:text-gray-400">
										{entry.coffeeWins} ☕ • {entry.totalPredictions} predictions
									</div>
								</div>
							</a>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Finished Games Section -->
	<div class="space-y-8">
		<!-- Finished Games -->
		{#if finishedGames.length > 0}
			<div>
				<h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
					Finished Games
				</h2>
				<div class="grid gap-6 md:grid-cols-2">
					{#each finishedGames as { game, predictionCount, winners }}
						<GameCard
							{game}
							{predictionCount}
							{winners}
							{accentColor}
							href="/games/{game.id}?groupId={data.group.id}"
						/>
					{/each}
				</div>
			</div>
		{/if}

		{#if data.games.length === 0}
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center border border-gray-200 dark:border-gray-700">
				<div class="text-gray-400 dark:text-gray-500 mb-4">
					<svg
						class="mx-auto h-12 w-12"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
						/>
					</svg>
				</div>
				<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
					No games yet
				</h3>
				<p class="text-gray-500 dark:text-gray-400">
					No games have been scheduled for this season yet.
				</p>
			</div>
		{/if}
	</div>
</div>
