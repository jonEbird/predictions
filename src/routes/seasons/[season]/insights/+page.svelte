<script lang="ts">
	import type { PageData } from './$types';
	import UserAvatar from '$lib/components/UserAvatar.svelte';
	import { formatET } from '$lib/datetime';

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

	// Our own team is a constant across the schedule, so labelling games with it says
	// nothing. Show who we played instead, with "@" marking away games.
	function opponentLabel(homeTeam: string, awayTeam: string) {
		const ourTeam = data.group.homeTeam;
		if (!ourTeam) return awayTeam;
		return homeTeam === ourTeam ? awayTeam : `@ ${homeTeam}`;
	}

	function truncate(label: string, max = 11) {
		return label.length > max ? `${label.slice(0, max - 1)}…` : label;
	}

	function formatDate(date: Date) {
		return formatET(date, {
			month: 'short',
			day: 'numeric'
		});
	}

	// Get unique games for x-axis
	$: uniqueGames = [...new Set(data.gamePerformance.map(p => p.gameId))].map(gameId => {
		const perf = data.gamePerformance.find(p => p.gameId === gameId)!;
		return {
			id: gameId,
			label: opponentLabel(perf.homeTeam, perf.awayTeam),
			fullLabel: `${perf.homeTeam} vs ${perf.awayTeam}`,
			time: perf.gameTime
		};
	}).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

	// Group game performance by user, keyed by game so a missed prediction leaves a
	// gap at the right x position instead of shifting every later point left.
	$: userPerformanceMap = data.gamePerformance.reduce((acc, perf) => {
		if (!acc[perf.userId]) {
			acc[perf.userId] = { id: perf.userId, name: perf.userName, byGame: new Map() };
		}
		acc[perf.userId].byGame.set(perf.gameId, perf.delta);
		return acc;
	}, {} as Record<number, { id: number; name: string; byGame: Map<number, number | null> }>);

	$: userPerformanceArray = Object.values(userPerformanceMap);

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

	// --- chart geometry ---
	const PLOT = { left: 50, right: 950, top: 20, bottom: 350 };

	// Scale to the data so high deltas aren't clipped off the top of the plot.
	$: maxDelta = Math.max(
		10,
		...data.gamePerformance.map((p) => p.delta ?? 0)
	);
	$: yTop = Math.ceil(maxDelta / 10) * 10;
	$: yTicks = Array.from({ length: yTop / 10 + 1 }, (_, i) => i * 10);

	function xFor(index: number, total: number) {
		return PLOT.left + (index / (total - 1 || 1)) * (PLOT.right - PLOT.left);
	}
	$: yFor = (delta: number) =>
		PLOT.bottom - (delta / yTop) * (PLOT.bottom - PLOT.top);

	$: series = userPerformanceArray.map((user, index) => ({
		id: user.id,
		name: user.name,
		color: colors[index % colors.length],
		points: uniqueGames
			.map((game, i) => {
				const delta = user.byGame.get(game.id);
				if (delta === undefined || delta === null) return null;
				return { x: xFor(i, uniqueGames.length), y: yFor(delta), delta, gameIndex: i };
			})
			.filter((p): p is { x: number; y: number; delta: number; gameIndex: number } => p !== null)
	}));

	// --- interaction ---
	// 9 overlapping lines can't be told apart by color alone, so emphasis is how a
	// reader isolates one: hover or focus previews, click pins it.
	let hoveredUserId: number | null = null;
	let pinnedUserId: number | null = null;
	let hoveredGameIndex: number | null = null;

	$: activeUserId = hoveredUserId ?? pinnedUserId;

	function togglePinned(userId: number) {
		pinnedUserId = pinnedUserId === userId ? null : userId;
	}

	// Declared reactively, not as a plain function: Svelte only tracks dependencies it
	// can see in the template expression, so a `function` body reading activeUserId
	// would never trigger a re-render.
	$: isDimmed = (userId: number) => activeUserId !== null && activeUserId !== userId;

	// Tooltip rows for the hovered game column: every series at that x, best first.
	$: tooltipRows =
		hoveredGameIndex === null
			? []
			: series
					.map((s) => ({
						name: s.name,
						color: s.color,
						id: s.id,
						delta: s.points.find((p) => p.gameIndex === hoveredGameIndex)?.delta ?? null
					}))
					.filter((r) => r.delta !== null)
					.sort((a, b) => (a.delta as number) - (b.delta as number));

	$: tooltipGame = hoveredGameIndex === null ? null : uniqueGames[hoveredGameIndex];
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
				Game-by-game delta over the season — lower is better. Hover a game for all
				scores; hover or click a name to isolate that player.
			</p>

			<div class="overflow-x-auto">
				<div class="min-w-[800px]" style="height: 400px; position: relative;">
					<!-- Simple line chart -->
					<svg
						width="100%"
						height="100%"
						viewBox="0 0 1000 400"
						class="border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900"
						role="img"
						aria-label="Game-by-game prediction delta for each player. Full values are in the table below."
						on:pointerleave={() => (hoveredGameIndex = null)}
					>
						<!-- Grid lines -->
						{#each yTicks as tick}
							<line
								x1={PLOT.left}
								y1={yFor(tick)}
								x2={PLOT.right}
								y2={yFor(tick)}
								stroke="currentColor"
								stroke-width="1"
								class="text-gray-300 dark:text-gray-700"
								stroke-dasharray="4"
							/>
							<text
								x={PLOT.left - 15}
								y={yFor(tick) + 4}
								text-anchor="end"
								class="text-xs fill-current text-gray-600 dark:text-gray-400"
							>
								{tick}
							</text>
						{/each}

						<!-- Crosshair for the hovered game -->
						{#if hoveredGameIndex !== null}
							<line
								x1={xFor(hoveredGameIndex, uniqueGames.length)}
								y1={PLOT.top}
								x2={xFor(hoveredGameIndex, uniqueGames.length)}
								y2={PLOT.bottom}
								stroke="currentColor"
								stroke-width="1"
								class="text-gray-400 dark:text-gray-500"
							/>
						{/if}

						<!-- Plot lines for each user -->
						{#each series as s}
							<g
								opacity={isDimmed(s.id) ? 0.12 : 1}
								style="transition: opacity 150ms;"
							>
								<polyline
									points={s.points.map((p) => `${p.x},${p.y}`).join(' ')}
									fill="none"
									stroke={s.color}
									stroke-width={activeUserId === s.id ? 3.5 : 2}
									stroke-linejoin="round"
									stroke-linecap="round"
								/>

								{#each s.points as p}
									<circle
										cx={p.x}
										cy={p.y}
										r={activeUserId === s.id ? 5.5 : 4}
										fill={s.color}
										stroke="currentColor"
										stroke-width="2"
										class="text-gray-50 dark:text-gray-900"
									/>
								{/each}
							</g>
						{/each}

						<!-- Transparent hit columns: the reader aims at a game, not at a 2px line -->
						{#each uniqueGames as game, i}
							{@const step = (PLOT.right - PLOT.left) / (uniqueGames.length - 1 || 1)}
							<rect
								x={xFor(i, uniqueGames.length) - step / 2}
								y={PLOT.top}
								width={step}
								height={PLOT.bottom - PLOT.top}
								fill="transparent"
								on:pointerenter={() => (hoveredGameIndex = i)}
							/>
						{/each}

						<!-- X-axis labels: the opponent, not our own team -->
						{#each uniqueGames as game, i}
							{@const x = xFor(i, uniqueGames.length)}
							<text
								{x}
								y="380"
								text-anchor="middle"
								class="text-xs fill-current {hoveredGameIndex === i
									? 'text-gray-900 dark:text-gray-100 font-semibold'
									: 'text-gray-600 dark:text-gray-400'}"
								transform="rotate(-45, {x}, 380)"
							>
								{truncate(game.label)}
							</text>
						{/each}

						<!-- Tooltip: every series at the hovered game, value first -->
						{#if tooltipGame && tooltipRows.length > 0}
							{@const rowH = 15}
							{@const boxH = 24 + tooltipRows.length * rowH}
							{@const boxW = 168}
							{@const cx = xFor(hoveredGameIndex ?? 0, uniqueGames.length)}
							{@const bx = Math.min(Math.max(cx + 14, PLOT.left), PLOT.right - boxW)}
							<g pointer-events="none">
								<rect
									x={bx}
									y={PLOT.top}
									width={boxW}
									height={boxH}
									rx="6"
									fill="currentColor"
									class="text-white dark:text-gray-800"
									stroke="currentColor"
									stroke-width="1"
									opacity="0.97"
								/>
								<rect
									x={bx}
									y={PLOT.top}
									width={boxW}
									height={boxH}
									rx="6"
									fill="none"
									stroke="currentColor"
									stroke-width="1"
									class="text-gray-300 dark:text-gray-600"
								/>
								<text
									x={bx + 10}
									y={PLOT.top + 16}
									class="text-xs font-semibold fill-current text-gray-900 dark:text-gray-100"
								>
									{truncate(tooltipGame.fullLabel, 24)}
								</text>
								{#each tooltipRows as row, ri}
									{@const ry = PLOT.top + 30 + ri * rowH}
									<line
										x1={bx + 10}
										y1={ry - 3}
										x2={bx + 22}
										y2={ry - 3}
										stroke={row.color}
										stroke-width="3"
										stroke-linecap="round"
									/>
									<text
										x={bx + 28}
										y={ry}
										class="fill-current {activeUserId === row.id
											? 'text-gray-900 dark:text-gray-100 font-semibold'
											: 'text-gray-600 dark:text-gray-400'}"
										style="font-size: 10px;"
									>
										{truncate(row.name, 16)}
									</text>
									<text
										x={bx + boxW - 10}
										y={ry}
										text-anchor="end"
										class="fill-current text-gray-900 dark:text-gray-100 font-semibold"
										style="font-size: 10px;"
									>
										{row.delta}
									</text>
								{/each}
							</g>
						{/if}
					</svg>
				</div>
			</div>

			<!-- Legend: hover or focus previews a player, click pins them -->
			<div class="mt-6 flex flex-wrap gap-2">
				{#each series as s}
					<button
						type="button"
						on:mouseenter={() => (hoveredUserId = s.id)}
						on:mouseleave={() => (hoveredUserId = null)}
						on:focus={() => (hoveredUserId = s.id)}
						on:blur={() => (hoveredUserId = null)}
						on:click={() => togglePinned(s.id)}
						aria-pressed={pinnedUserId === s.id}
						class="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-150 {pinnedUserId ===
						s.id
							? 'border-gray-400 dark:border-gray-400 bg-gray-100 dark:bg-gray-700 shadow-sm'
							: 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'} {isDimmed(s.id)
							? 'opacity-40'
							: 'opacity-100'}"
					>
						<span class="w-4 h-1.5 rounded-full" style="background-color: {s.color};"></span>
						<span class="text-sm text-gray-700 dark:text-gray-300">{s.name}</span>
					</button>
				{/each}
				{#if pinnedUserId !== null}
					<button
						type="button"
						on:click={() => (pinnedUserId = null)}
						class="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 underline"
					>
						Show all
					</button>
				{/if}
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