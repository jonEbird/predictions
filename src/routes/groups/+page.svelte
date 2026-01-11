<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;

	function getSeasonLabel(season: number) {
		return `${season} Season`;
	}
</script>

<svelte:head>
	<title>My Groups | Predictions</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">My Groups</h1>
		<p class="mt-2 text-gray-600 dark:text-gray-400">
			Select a group to view games and leaderboard
		</p>
	</div>

	{#if data.groups.length === 0}
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
						d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
					/>
				</svg>
			</div>
			<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
				No groups yet
			</h3>
			<p class="text-gray-500 dark:text-gray-400">
				You haven't joined any prediction groups yet. Contact an admin to get invited!
			</p>
		</div>
	{:else}
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each data.groups as { group, membership, memberCount, upcomingGamesCount }}
				<a
					href="/groups/{group.slug}?season={group.season}"
					class="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200 dark:border-gray-700"
				>
					{#if group.pictureUrl}
						<div class="mb-4">
							<img
								src={group.pictureUrl}
								alt={group.name}
								class="w-full h-32 object-cover rounded-lg"
							/>
						</div>
					{/if}

					<div class="flex items-start justify-between mb-2">
						<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
							{group.name}
						</h2>
						{#if membership.role === 'admin'}
							<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
								Admin
							</span>
						{/if}
					</div>

					<div class="text-sm text-gray-600 dark:text-gray-400 mb-4">
						{getSeasonLabel(group.season)}
					</div>

					{#if group.description}
						<p class="text-gray-700 dark:text-gray-300 text-sm mb-4 line-clamp-2">
							{group.description}
						</p>
					{/if}

					<div class="flex items-center justify-between text-sm border-t border-gray-200 dark:border-gray-700 pt-4">
						<div class="flex items-center gap-4">
							<div class="flex items-center gap-1 text-gray-600 dark:text-gray-400">
								<svg
									class="w-4 h-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
									/>
								</svg>
								<span>{memberCount}</span>
							</div>

							<div class="flex items-center gap-1 text-gray-600 dark:text-gray-400">
								<svg
									class="w-4 h-4"
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
								<span>{upcomingGamesCount} upcoming</span>
							</div>
						</div>

						{#if membership.betting}
							<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
								☕ Betting
							</span>
						{/if}
					</div>

					{#if group.prize}
						<div class="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
							<span>Prize:</span>
							<span class="font-medium">{group.prize}</span>
						</div>
					{/if}
				</a>
			{/each}
		</div>
	{/if}
</div>
