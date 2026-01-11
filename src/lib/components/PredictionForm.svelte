<script lang="ts">
	import type { Game } from '$lib/db/schema';
	import { enhance } from '$app/forms';

	export let game: Game;
	export let groupId: number;
	export let existingPrediction:
		| { homeScore: number; awayScore: number; id: number }
		| null = null;

	let homeScore = existingPrediction?.homeScore ?? 0;
	let awayScore = existingPrediction?.awayScore ?? 0;
	let isSubmitting = false;

	function formatGameTime(timestamp: Date) {
		const date = new Date(timestamp);
		return date.toLocaleString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
	<h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
		{existingPrediction ? 'Edit Your Prediction' : 'Make Your Prediction'}
	</h2>

	<div class="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
		<div class="text-sm text-gray-600 dark:text-gray-400 mb-2">
			Game Time: {formatGameTime(game.gameTime)}
		</div>
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<span class="font-semibold text-gray-900 dark:text-gray-100">{game.homeTeam}</span>
				<span class="text-sm text-gray-500 dark:text-gray-400">Home</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="font-semibold text-gray-900 dark:text-gray-100">{game.awayTeam}</span>
				<span class="text-sm text-gray-500 dark:text-gray-400">Away</span>
			</div>
		</div>
	</div>

	<form method="POST" action="?/predict" use:enhance={() => {
		isSubmitting = true;
		return async ({ update }) => {
			await update();
			isSubmitting = false;
		};
	}}>
		<input type="hidden" name="gameId" value={game.id} />
		<input type="hidden" name="groupId" value={groupId} />
		{#if existingPrediction}
			<input type="hidden" name="predictionId" value={existingPrediction.id} />
		{/if}

		<div class="space-y-4">
			<div>
				<label for="homeScore" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					{game.homeTeam} Score
				</label>
				<input
					type="number"
					id="homeScore"
					name="homeScore"
					bind:value={homeScore}
					min="0"
					max="999"
					required
					class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
				/>
			</div>

			<div>
				<label for="awayScore" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					{game.awayTeam} Score
				</label>
				<input
					type="number"
					id="awayScore"
					name="awayScore"
					bind:value={awayScore}
					min="0"
					max="999"
					required
					class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
				/>
			</div>

			<div class="pt-4">
				<button
					type="submit"
					disabled={isSubmitting}
					class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-md transition-colors"
				>
					{#if isSubmitting}
						Submitting...
					{:else if existingPrediction}
						Update Prediction
					{:else}
						Submit Prediction
					{/if}
				</button>
			</div>

			{#if existingPrediction}
				<p class="text-sm text-gray-500 dark:text-gray-400 text-center">
					You can edit your prediction until the game starts
				</p>
			{/if}
		</div>
	</form>
</div>
