<script lang="ts">
	import type { Game } from '$lib/db/schema';
	import { enhance } from '$app/forms';
	import { formatET, easternAbbreviation } from '$lib/datetime';
	import UserAvatar from './UserAvatar.svelte';

	export let game: Game;
	export let groupId: number;
	export let existingPrediction:
		| { homeScore: number; awayScore: number; id: number }
		| null = null;
	/**
	 * Whose prediction this is. Shown as an avatar + name so an admin entering on
	 * someone else's behalf can see at a glance it isn't their own.
	 */
	export let user: { name: string; nickname: string | null; mugshotUrl: string | null } | null =
		null;

	// Empty rather than 0 so the "Score" placeholder shows, and `required` stops an
	// accidental 0-0 from being submitted as a real pick.
	let homeScore: number | string = existingPrediction?.homeScore ?? '';
	let awayScore: number | string = existingPrediction?.awayScore ?? '';
	let isSubmitting = false;

	function formatGameTime(timestamp: Date) {
		return `${formatET(timestamp, {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		})} ${easternAbbreviation(timestamp)}`;
	}
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
	{#if user}
		<div class="flex items-center gap-3 mb-5">
			<UserAvatar name={user.name} mugshotUrl={user.mugshotUrl} size="md" />
			<div>
				<div class="font-bold text-lg text-gray-900 dark:text-gray-100">{user.name}</div>
				{#if user.nickname}
					<div class="text-sm text-gray-500 dark:text-gray-400">"{user.nickname}"</div>
				{/if}
			</div>
		</div>
	{:else}
		<h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
			{existingPrediction ? 'Edit Your Prediction' : 'Make Your Prediction'}
		</h2>
	{/if}

	<div class="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
		<div class="text-sm text-gray-600 dark:text-gray-400 mb-3">
			{formatGameTime(game.gameTime)}
		</div>
		<div class="space-y-1">
			<div class="flex items-center gap-3">
				<span class="font-bold text-lg text-gray-900 dark:text-gray-100">{game.homeTeam}</span>
				<span class="text-sm text-gray-500 dark:text-gray-400">Home</span>
			</div>
			<div class="flex items-center gap-3">
				<span class="font-bold text-lg text-gray-900 dark:text-gray-100">{game.awayTeam}</span>
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

		<div class="grid grid-cols-2 gap-4">
			<div>
				<label
					for="homeScore"
					class="flex items-center gap-2 text-sm mb-1 text-gray-700 dark:text-gray-300"
				>
					<span class="font-bold text-gray-900 dark:text-gray-100">{game.homeTeam}</span>
					<span class="text-gray-500 dark:text-gray-400">Home</span>
				</label>
				<input
					type="number"
					id="homeScore"
					name="homeScore"
					bind:value={homeScore}
					min="0"
					max="999"
					required
					placeholder="Score"
					class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-lg font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
				/>
			</div>

			<div>
				<label
					for="awayScore"
					class="flex items-center gap-2 text-sm mb-1 text-gray-700 dark:text-gray-300"
				>
					<span class="font-bold text-gray-900 dark:text-gray-100">{game.awayTeam}</span>
					<span class="text-gray-500 dark:text-gray-400">Away</span>
				</label>
				<input
					type="number"
					id="awayScore"
					name="awayScore"
					bind:value={awayScore}
					min="0"
					max="999"
					required
					placeholder="Score"
					class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-lg font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
				/>
			</div>
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
			<p class="mt-3 text-sm text-gray-500 dark:text-gray-400 text-center">
				You can edit your prediction until the game starts
			</p>
		{/if}
	</form>
</div>
