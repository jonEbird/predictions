<script lang="ts">
	import type { PageData } from './$types';
	import UserAvatar from '$lib/components/UserAvatar.svelte';

	export let data: PageData;

	// Sorting state
	let sortBy: 'coffee' | 'avgDelta' | 'total' | 'participation' = 'coffee';
	let sortAsc = false;

	$: sortedLeaderboard = [...data.leaderboard].sort((a, b) => {
		let aVal, bVal;
		switch (sortBy) {
			case 'coffee':
				aVal = a.coffeeWins;
				bVal = b.coffeeWins;
				break;
			case 'avgDelta':
				aVal = a.avgDelta ?? Infinity;
				bVal = b.avgDelta ?? Infinity;
				break;
			case 'total':
				aVal = a.totalDelta ?? Infinity;
				bVal = b.totalDelta ?? Infinity;
				break;
			case 'participation':
				aVal = a.totalPredictions;
				bVal = b.totalPredictions;
				break;
		}
		return sortAsc ? aVal - bVal : bVal - aVal;
	});

	function formatGameLabel(game: any) {
		return `${game.homeTeam} vs ${game.awayTeam}`;
	}

	function formatDate(date: Date) {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}

	// Group game performance by user for chart
	$: userPerformanceMap = data.gamePerformance.reduce((acc, perf) => {
		if (!acc[perf.userId]) {
			acc[perf.userId] = {
				name: perf.userName,
				data: []
			};
		}
		acc[perf.userId].data.push({
			gameId: perf.gameId,
			gameLabel: `${perf.homeTeam} vs ${perf.awayTeam}`,
			gameTime: perf.gameTime,
			delta: perf.delta
		});
		return acc;
	}, {} as Record<number, { name: string; data: Array<{ gameId: number; gameLabel: string; gameTime: Date; delta: number | null }> }>);

	$: userPerformanceArray = Object.values(userPerformanceMap);

	// Get unique games for x-axis
	$: uniqueGames = [...new Set(data.gamePerformance.map(p => p.gameId))].map(gameId => {
		const perf = data.gamePerformance.find(p => p.gameId === gameId)!;
		return {
			id: gameId,
			label: `${perf.homeTeam} vs ${perf.awayTeam}`,
			time: perf.gameTime
		};
	}).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

	// Color palette for users
	const colors = [
		'#3B82F6', // blue
		'#EF4444', // red
		'#F59E0B', // orange
		'#10B981', // green
		'#8B5CF6', // purple
		'#06B6D4', // cyan
		'#EC4899', // pink
		'#F97316', // orange
		'#14B8A6'  // teal
	];
</script>

<svelte:head>
	<title>{data.season} Season Insights | Predictions</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Header -->
	<div class="mb-8">
		<div class="flex items-center justify-between mb-4">
			<h1 class="text-4xl font-bold text-gray-900 dark:text-gray-100">
				📊 {data.season} Season Insights
			</h1>
			<a
				href="/groups/{data.group.slug}?season={data.season}"
				class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
			>
				← Back to Games
			</a>
		</div>
		<p class="text-gray-600 dark:text-gray-400">
			Deep dive into season statistics and performance analysis
		</p>
	</div>

	<!-- Insight Cards -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
		<!-- Total Games -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
			<div class="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Games</div>
			<div class="text-3xl font-bold text-gray-900 dark:text-gray-100">
				{data.insights.totalGames}
			</div>
			<div class="text-sm text-gray-500 dark:text-gray-400 mt-1">
				{data.insights.totalPredictions} predictions made
			</div>
		</div>

		<!-- Total Members -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
			<div class="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Players</div>
			<div class="text-3xl font-bold text-gray-900 dark:text-gray-100">
				{data.insights.totalMembers}
			</div>
			<div class="text-sm text-gray-500 dark:text-gray-400 mt-1">
				Active participants
			</div>
		</div>

		<!-- Hardest Game -->
		{#if data.insights.hardestGame}
			<div class="bg-red-50 dark:bg-red-900/20 rounded-lg shadow-md p-6 border border-red-200 dark:border-red-800">
				<div class="text-sm text-red-700 dark:text-red-300 mb-1">🔥 Hardest Game</div>
				<div class="text-lg font-bold text-red-900 dark:text-red-100">
					{formatGameLabel(data.insights.hardestGame.game)}
				</div>
				<div class="text-sm text-red-700 dark:text-red-300 mt-1">
					{data.insights.hardestGame.avgDelta?.toFixed(1)} avg delta
				</div>
			</div>
		{/if}

		<!-- Easiest Game -->
		{#if data.insights.easiestGame}
			<div class="bg-green-50 dark:bg-green-900/20 rounded-lg shadow-md p-6 border border-green-200 dark:border-green-800">
				<div class="text-sm text-green-700 dark:text-green-300 mb-1">✨ Easiest Game</div>
				<div class="text-lg font-bold text-green-900 dark:text-green-100">
					{formatGameLabel(data.insights.easiestGame.game)}
				</div>
				<div class="text-sm text-green-700 dark:text-green-300 mt-1">
					{data.insights.easiestGame.avgDelta?.toFixed(1)} avg delta
				</div>
			</div>
		{/if}
	</div>

	<!-- Performance Chart -->
	{#if uniqueGames.length > 0}
		<div class="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
			<h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
				Prediction Performance
			</h2>
			<p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
				Game-by-game delta over the season
			</p>

			<div class="overflow-x-auto">
				<div class="min-w-[800px]" style="height: 400px; position: relative;">
					<!-- Simple line chart -->
					<svg width="100%" height="100%" viewBox="0 0 1000 400" class="border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900">
						<!-- Grid lines -->
						{#each [0, 10, 20, 30, 40, 50] as y}
							<line
								x1="50"
								y1={350 - y * 6}
								x2="950"
								y2={350 - y * 6}
								stroke="currentColor"
								stroke-width="1"
								class="text-gray-300 dark:text-gray-700"
								stroke-dasharray="4"
							/>
							<text
								x="35"
								y={355 - y * 6}
								text-anchor="end"
								class="text-xs fill-current text-gray-600 dark:text-gray-400"
							>
								{y}
							</text>
						{/each}

						<!-- Plot lines for each user -->
						{#each userPerformanceArray as userPerf, userIndex}
							{@const color = colors[userIndex % colors.length]}
							{@const points = userPerf.data
								.map((d, i) => {
									const x = 50 + (i / (uniqueGames.length - 1 || 1)) * 900;
									const y = 350 - ((d.delta ?? 0) * 6);
									return `${x},${y}`;
								})
								.join(' ')}

							<polyline
								points={points}
								fill="none"
								stroke={color}
								stroke-width="2"
								opacity="0.8"
							/>

							<!-- Data points -->
							{#each userPerf.data as d, i}
								{@const x = 50 + (i / (uniqueGames.length - 1 || 1)) * 900}
								{@const y = 350 - ((d.delta ?? 0) * 6)}
								<circle cx={x} cy={y} r="4" fill={color} />
							{/each}
						{/each}

						<!-- X-axis labels -->
						{#each uniqueGames as game, i}
							{@const x = 50 + (i / (uniqueGames.length - 1 || 1)) * 900}
							<text
								x={x}
								y="380"
								text-anchor="middle"
								class="text-xs fill-current text-gray-600 dark:text-gray-400"
								transform="rotate(-45, {x}, 380)"
							>
								{game.label.split(' vs ')[0].substring(0, 8)}
							</text>
						{/each}
					</svg>
				</div>
			</div>

			<!-- Legend -->
			<div class="mt-6 flex flex-wrap gap-4">
				{#each userPerformanceArray as userPerf, userIndex}
					{@const color = colors[userIndex % colors.length]}
					<div class="flex items-center gap-2">
						<div class="w-4 h-4 rounded" style="background-color: {color};"></div>
						<span class="text-sm text-gray-700 dark:text-gray-300">{userPerf.name}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Full Leaderboard -->
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
		<h2 class="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
			Complete Leaderboard
		</h2>

		<div class="overflow-x-auto">
			<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
				<thead class="bg-gray-50 dark:bg-gray-900">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Rank
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Player
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
							on:click={() => {
								sortBy = 'coffee';
								sortAsc = sortBy === 'coffee' ? !sortAsc : false;
							}}
						>
							☕ Coffee Wins {sortBy === 'coffee' ? (sortAsc ? '↑' : '↓') : ''}
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
							on:click={() => {
								sortBy = 'avgDelta';
								sortAsc = sortBy === 'avgDelta' ? !sortAsc : true;
							}}
						>
							Avg Delta {sortBy === 'avgDelta' ? (sortAsc ? '↑' : '↓') : ''}
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
							on:click={() => {
								sortBy = 'total';
								sortAsc = sortBy === 'total' ? !sortAsc : true;
							}}
						>
							Total Delta {sortBy === 'total' ? (sortAsc ? '↑' : '↓') : ''}
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
							on:click={() => {
								sortBy = 'participation';
								sortAsc = sortBy === 'participation' ? !sortAsc : false;
							}}
						>
							Games {sortBy === 'participation' ? (sortAsc ? '↑' : '↓') : ''}
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Best
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Worst
						</th>
					</tr>
				</thead>
				<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
					{#each sortedLeaderboard as entry, index}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
								{index + 1}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="flex items-center">
									<UserAvatar
										name={entry.user.name}
										mugshotUrl={entry.user.mugshotUrl}
										size="sm"
									/>
									<div class="ml-3">
										<div class="text-sm font-medium text-gray-900 dark:text-gray-100">
											{entry.user.name}
										</div>
										{#if entry.user.nickname}
											<div class="text-xs text-gray-500 dark:text-gray-400">
												"{entry.user.nickname}"
											</div>
										{/if}
									</div>
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
								{entry.coffeeWins}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
								{entry.avgDelta?.toFixed(1) ?? '-'}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
								{entry.totalDelta ?? '-'}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
								{entry.totalPredictions}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400">
								{entry.bestDelta ?? '-'}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400">
								{entry.worstDelta ?? '-'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>