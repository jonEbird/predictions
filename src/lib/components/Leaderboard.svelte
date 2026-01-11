<script lang="ts">
	import type { User } from '$lib/db/schema';

	export let leaderboard: Array<{
		user: User;
		coffeeWins: number;
		totalPredictions: number;
		avgDelta: number | null;
	}> = [];
	export let title: string = 'Leaderboard';
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
	<h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{title}</h2>

	{#if leaderboard.length === 0}
		<p class="text-gray-500 dark:text-gray-400 text-center py-8">No predictions yet</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
				<thead>
					<tr>
						<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Rank
						</th>
						<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Player
						</th>
						<th class="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Coffee Wins
						</th>
						<th class="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Predictions
						</th>
						<th class="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Avg Delta
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
					{#each leaderboard as entry, index}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
							<td class="px-3 py-4 whitespace-nowrap">
								<span class="text-sm font-medium text-gray-900 dark:text-gray-100">
									{#if index === 0}
										🥇
									{:else if index === 1}
										🥈
									{:else if index === 2}
										🥉
									{:else}
										{index + 1}
									{/if}
								</span>
							</td>
							<td class="px-3 py-4 whitespace-nowrap">
								<div class="flex items-center">
									<div>
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
							<td class="px-3 py-4 whitespace-nowrap text-center">
								<span class="text-sm font-bold text-yellow-600 dark:text-yellow-400">
									{entry.coffeeWins}
								</span>
							</td>
							<td class="px-3 py-4 whitespace-nowrap text-center">
								<span class="text-sm text-gray-900 dark:text-gray-100">
									{entry.totalPredictions}
								</span>
							</td>
							<td class="px-3 py-4 whitespace-nowrap text-center">
								<span class="text-sm text-gray-900 dark:text-gray-100">
									{entry.avgDelta !== null ? entry.avgDelta.toFixed(1) : '-'}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
