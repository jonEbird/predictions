<script lang="ts">
	import type { Game, User } from '$lib/db/schema';
	import GameStatus from './GameStatus.svelte';
	import UserAvatar from './UserAvatar.svelte';

	export let game: Game;
	export let predictionCount: number = 0;
	export let href: string | undefined = undefined;
	export let winners: User[] = [];
	export let accentColor: string = '#666666';

	function formatGameTime(timestamp: Date | null) {
		if (!timestamp) return '';
		const date = new Date(timestamp);
		return date.toLocaleString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function getScoreDisplay() {
		if (game.status === 'canceled') {
			return 'Canceled';
		}
		// Show game time for all games (for finished games, scores are already displayed next to team names)
		return formatGameTime(game.gameTime);
	}
</script>

{#if href}
	<a
		{href}
		class="block bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 hover:scale-102 p-5 border border-gray-200 dark:border-gray-700"
	>
		<div class="flex items-center justify-between">
			<div class="flex-1">
				<div class="flex items-center gap-3 mb-3">
					<GameStatus status={game.status} />
					{#if predictionCount > 0}
						<span class="text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
							{predictionCount} prediction{predictionCount !== 1 ? 's' : ''}
						</span>
					{/if}
				</div>

				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<span class="font-bold text-lg text-gray-900 dark:text-gray-100">
							{game.homeTeam}
						</span>
						{#if game.homeScore !== null}
							<span class="text-2xl font-bold text-gray-900 dark:text-gray-100">
								{game.homeScore}
							</span>
						{/if}
					</div>

					<div class="flex items-center justify-between">
						<span class="font-bold text-lg text-gray-900 dark:text-gray-100">
							{game.awayTeam}
						</span>
						{#if game.awayScore !== null}
							<span class="text-2xl font-bold text-gray-900 dark:text-gray-100">
								{game.awayScore}
							</span>
						{/if}
					</div>
				</div>

				<div class="mt-3 text-sm font-medium text-gray-600 dark:text-gray-400">
					{getScoreDisplay()}
				</div>

				{#if game.status === 'finished' && winners.length > 0}
					<div class="mt-4 pt-4 border-t-2 border-gray-200 dark:border-gray-700">
						<div class="flex flex-wrap gap-2">
							{#each winners as winner}
								<div class="flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-sm" style="background-color: {accentColor}15;">
									<UserAvatar name={winner.name} mugshotUrl={winner.mugshotUrl} size="xs" />
									<span class="text-sm font-bold" style="color: {accentColor};">
										{winner.name}
									</span>
									<span class="text-lg">☕</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<div class="ml-6">
				<svg
					class="w-6 h-6 text-gray-400 transition-transform group-hover:translate-x-1"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 5l7 7-7 7"
					/>
				</svg>
			</div>
		</div>
	</a>
{:else}
	<div
		class="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-md p-5 border border-gray-200 dark:border-gray-700"
	>
		<div class="flex items-center gap-3 mb-3">
			<GameStatus status={game.status} />
			{#if predictionCount > 0}
				<span class="text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
					{predictionCount} prediction{predictionCount !== 1 ? 's' : ''}
				</span>
			{/if}
		</div>

		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<span class="font-bold text-lg text-gray-900 dark:text-gray-100">
					{game.homeTeam}
				</span>
				{#if game.homeScore !== null}
					<span class="text-2xl font-bold text-gray-900 dark:text-gray-100">
						{game.homeScore}
					</span>
				{/if}
			</div>

			<div class="flex items-center justify-between">
				<span class="font-bold text-lg text-gray-900 dark:text-gray-100">
					{game.awayTeam}
				</span>
				{#if game.awayScore !== null}
					<span class="text-2xl font-bold text-gray-900 dark:text-gray-100">
						{game.awayScore}
					</span>
				{/if}
			</div>
		</div>

		<div class="mt-3 text-sm font-medium text-gray-600 dark:text-gray-400">
			{getScoreDisplay()}
		</div>

		{#if game.status === 'finished' && winners.length > 0}
			<div class="mt-4 pt-4 border-t-2 border-gray-200 dark:border-gray-700">
				<div class="flex flex-wrap gap-2">
					{#each winners as winner}
						<div class="flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-sm" style="background-color: {accentColor}15;">
							<UserAvatar name={winner.name} mugshotUrl={winner.mugshotUrl} size="xs" />
							<span class="text-sm font-bold" style="color: {accentColor};">
								{winner.name}
							</span>
							<span class="text-lg">☕</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}
