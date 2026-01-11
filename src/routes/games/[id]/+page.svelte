<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import GameStatus from '$lib/components/GameStatus.svelte';
	import PredictionForm from '$lib/components/PredictionForm.svelte';
	import RankBadge from '$lib/components/RankBadge.svelte';
	import UserAvatar from '$lib/components/UserAvatar.svelte';

	export let data: PageData;
	export let form: any;

	let isUpdatingScore = false;
	let adminHomeScore = data.game.homeScore?.toString() || '';
	let adminAwayScore = data.game.awayScore?.toString() || '';
	let adminStatus = data.game.status;

	// Track which prediction is being edited
	let editingPredictionId: number | null = null;
	let editingUserId: number | null = null; // For adding new predictions
	let editHomeScore = '';
	let editAwayScore = '';

	function startEditPrediction(predictionId: number, homeScore: number, awayScore: number) {
		editingPredictionId = predictionId;
		editingUserId = null;
		editHomeScore = ''; // Start with empty form
		editAwayScore = '';
	}

	function startAddPrediction(userId: number) {
		editingPredictionId = null;
		editingUserId = userId;
		editHomeScore = '';
		editAwayScore = '';
	}

	function cancelEditPrediction() {
		editingPredictionId = null;
		editingUserId = null;
		editHomeScore = '';
		editAwayScore = '';
	}

	function formatGameTime(timestamp: Date) {
		const date = new Date(timestamp);
		return date.toLocaleString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function getScoreDifference(homeScore: number, awayScore: number): string {
		const diff = Math.abs(homeScore - awayScore);
		const winner = homeScore > awayScore ? 'Home' : awayScore > homeScore ? 'Away' : 'Tie';
		if (winner === 'Tie') return 'Tie game';
		return `${winner} by ${diff}`;
	}
</script>

<svelte:head>
	<title>{data.game.homeTeam} vs {data.game.awayTeam} | Predictions</title>
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
			Back to Games
		</a>
	</div>

	<!-- Game Header -->
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-200 dark:border-gray-700">
		<div class="flex items-center justify-between mb-4">
			<GameStatus status={data.game.status} />
			<div class="text-sm text-gray-600 dark:text-gray-400">
				{formatGameTime(data.game.gameTime)}
			</div>
		</div>

		<!-- Teams and Scores -->
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<span class="text-2xl font-bold text-gray-900 dark:text-gray-100">
						{data.game.homeTeam}
					</span>
					<span class="text-sm text-gray-500 dark:text-gray-400">Home</span>
				</div>
				{#if data.game.homeScore !== null}
					<span class="text-3xl font-bold text-gray-900 dark:text-gray-100">
						{data.game.homeScore}
					</span>
				{/if}
			</div>

			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<span class="text-2xl font-bold text-gray-900 dark:text-gray-100">
						{data.game.awayTeam}
					</span>
					<span class="text-sm text-gray-500 dark:text-gray-400">Away</span>
				</div>
				{#if data.game.awayScore !== null}
					<span class="text-3xl font-bold text-gray-900 dark:text-gray-100">
						{data.game.awayScore}
					</span>
				{/if}
			</div>
		</div>

		{#if data.game.status === 'finished' && data.predictions.length > 0}
			{@const winners = data.predictions.filter((p) => p.prediction.wonCoffee)}
			{#if winners.length > 0}
				<div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
					<div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						{winners.length === 1 ? 'Winner' : 'Winners'}:
					</div>
					<div class="flex flex-wrap gap-2">
						{#each winners as { user }}
							<div class="flex items-center gap-2 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
								<UserAvatar name={user.name} mugshotUrl={user.mugshotUrl} size="xs" />
								<span class="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
									{user.name}
								</span>
								<span class="text-lg">☕</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Success/Error Messages -->
	{#if form?.success}
		<div class="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
			<p class="text-green-800 dark:text-green-200">{form.message}</p>
		</div>
	{:else if form?.message}
		<div class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
			<p class="text-red-800 dark:text-red-200">{form.message}</p>
		</div>
	{/if}

	<!-- Admin Panel -->
	{#if data.isAdmin}
		<div class="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
			<h3 class="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
				Admin: Update Game
			</h3>

			<form
				method="POST"
				action="?/updateFinalScore"
				use:enhance={() => {
					isUpdatingScore = true;
					return async ({ update }) => {
						await update();
						isUpdatingScore = false;
					};
				}}
			>
				<input type="hidden" name="groupId" value={data.groupId} />

				<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
					<div>
						<label for="adminHomeScore" class="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
							{data.game.homeTeam} Score
						</label>
						<input
							type="number"
							id="adminHomeScore"
							name="homeScore"
							bind:value={adminHomeScore}
							required
							min="0"
							class="w-full px-4 py-2 border border-blue-300 dark:border-blue-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
						/>
					</div>

					<div>
						<label for="adminAwayScore" class="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
							{data.game.awayTeam} Score
						</label>
						<input
							type="number"
							id="adminAwayScore"
							name="awayScore"
							bind:value={adminAwayScore}
							required
							min="0"
							class="w-full px-4 py-2 border border-blue-300 dark:border-blue-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
						/>
					</div>

					<div>
						<label for="adminStatus" class="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
							Game Status
						</label>
						<select
							id="adminStatus"
							name="status"
							bind:value={adminStatus}
							required
							class="w-full px-4 py-2 border border-blue-300 dark:border-blue-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
						>
							<option value="live">Live</option>
							<option value="finished">Finished</option>
							<option value="canceled">Canceled</option>
						</select>
					</div>
				</div>

				<button
					type="submit"
					disabled={isUpdatingScore}
					class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-md transition-colors"
				>
					{isUpdatingScore ? 'Updating...' : 'Update Game Score & Status'}
				</button>
			</form>
		</div>
	{/if}

	<!-- Main Content Area -->
	<div class="grid gap-6 lg:grid-cols-3">
		<div class="lg:col-span-2">
			<!-- Prediction Form (if game hasn't started and user can predict) -->
			{#if data.canPredict}
				<PredictionForm game={data.game} groupId={data.groupId} existingPrediction={data.userPrediction} />
			{:else if !data.gameStarted && data.userPrediction}
				<div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
					<div class="flex items-start gap-3">
						<svg
							class="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<div>
							<h3 class="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
								Prediction Submitted!
							</h3>
							<div class="text-green-800 dark:text-green-200">
								<p class="mb-2">Your prediction:</p>
								<p class="font-bold">
									{data.game.homeTeam}: {data.userPrediction.homeScore}<br />
									{data.game.awayTeam}: {data.userPrediction.awayScore}
								</p>
								<p class="mt-3 text-sm">
									Predictions will be visible once the game starts.
								</p>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- All Member Predictions (before game starts) -->
			{#if !data.gameStarted}
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 {data.canPredict || data.userPrediction ? 'mt-6' : ''}">
					<h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
						{data.isAdmin ? 'All Predictions (Admin View)' : 'All Predictions'}
					</h2>

					<div class="space-y-3">
						{#each data.memberStatus as member}
							{@const memberPrediction = data.predictions.find(p => p.user.id === member.user.id)}
							<div class="p-4 rounded-lg border bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700">
								<div class="flex items-start justify-between mb-3">
									<div class="flex items-center gap-3">
										<UserAvatar name={member.user.name} mugshotUrl={member.user.mugshotUrl} size="sm" />
										<div>
											<div class="font-semibold text-gray-900 dark:text-gray-100">
												{member.user.name}
											</div>
											{#if member.user.nickname}
												<div class="text-xs text-gray-500 dark:text-gray-400">
													"{member.user.nickname}"
												</div>
											{/if}
										</div>
									</div>

									{#if member.hasPredicted}
										<span class="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">
											Predicted
										</span>
									{:else}
										<span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
											Not predicted
										</span>
									{/if}
								</div>

								{#if data.isAdmin && (editingPredictionId === memberPrediction?.prediction.id || editingUserId === member.user.id)}
									<!-- Edit/Add Mode (Admin only) -->
									<form
										method="POST"
										action={editingPredictionId ? '?/editPrediction' : '?/addPrediction'}
										use:enhance={() => {
											return async ({ update }) => {
												await update();
												cancelEditPrediction();
											};
										}}
									>
										{#if editingPredictionId}
											<input type="hidden" name="predictionId" value={memberPrediction.prediction.id} />
										{:else}
											<input type="hidden" name="userId" value={member.user.id} />
										{/if}
										<input type="hidden" name="groupId" value={data.groupId} />

										<div class="grid grid-cols-2 gap-4 text-sm mb-3">
											<div>
												<div class="text-gray-500 dark:text-gray-400 mb-1">{data.game.homeTeam}</div>
												<input
													type="number"
													name="homeScore"
													bind:value={editHomeScore}
													required
													min="0"
													placeholder="Score"
													class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-lg font-bold dark:bg-gray-700 dark:text-gray-100"
												/>
											</div>
											<div>
												<div class="text-gray-500 dark:text-gray-400 mb-1">{data.game.awayTeam}</div>
												<input
													type="number"
													name="awayScore"
													bind:value={editAwayScore}
													required
													min="0"
													placeholder="Score"
													class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-lg font-bold dark:bg-gray-700 dark:text-gray-100"
												/>
											</div>
										</div>

										<div class="flex gap-2">
											<button
												type="submit"
												class="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
											>
												{editingPredictionId ? 'Save' : 'Add Prediction'}
											</button>
											<button
												type="button"
												on:click={cancelEditPrediction}
												class="flex-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-md transition-colors"
											>
												Cancel
											</button>
										</div>
									</form>
								{:else if member.hasPredicted}
									<!-- Display "Locked-in" for all users -->
									<div class="grid grid-cols-2 gap-4 text-sm">
										<div>
											<div class="text-gray-500 dark:text-gray-400">{data.game.homeTeam}</div>
											<div class="text-lg font-bold text-green-600 dark:text-green-400">
												Locked-in
											</div>
										</div>
										<div>
											<div class="text-gray-500 dark:text-gray-400">{data.game.awayTeam}</div>
											<div class="text-lg font-bold text-green-600 dark:text-green-400">
												Locked-in
											</div>
										</div>
									</div>

									{#if data.isAdmin}
										<div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
											<button
												type="button"
												on:click={() => startEditPrediction(memberPrediction.prediction.id, 0, 0)}
												class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
											>
												<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
												</svg>
												Edit prediction
											</button>
										</div>
									{/if}
								{:else}
									<!-- No prediction yet -->
									{#if data.isAdmin}
										<div class="text-center py-4">
											<button
												type="button"
												on:click={() => startAddPrediction(member.user.id)}
												class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 mx-auto"
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
												</svg>
												Add prediction for {member.user.name}
											</button>
										</div>
									{:else}
										<div class="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
											No prediction yet
										</div>
									{/if}
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Predictions List (if game has started) -->
			{#if data.gameStarted && data.predictions.length > 0}
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
					<h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
						{data.game.status === 'finished' ? 'Final Results' : 'Live Predictions'}
					</h2>

					<div class="space-y-3">
						{#each data.predictions as { prediction, user }, index}
							<div
								class="p-4 rounded-lg border transition-colors {prediction.wonCoffee
									? 'bg-yellow-50 border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-700'
									: 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700'}"
							>
								<div class="flex items-start justify-between mb-3">
									<div class="flex items-center gap-3">
										<UserAvatar name={user.name} mugshotUrl={user.mugshotUrl} size="sm" />
										<div>
											<div class="font-semibold text-gray-900 dark:text-gray-100">
												{user.name}
											</div>
											{#if user.nickname}
												<div class="text-xs text-gray-500 dark:text-gray-400">
													"{user.nickname}"
												</div>
											{/if}
										</div>
									</div>

									{#if data.game.homeScore !== null && data.game.awayScore !== null}
										{#if data.game.status === 'finished'}
											<RankBadge
												rank={prediction.rank}
												delta={prediction.delta}
												wonCoffee={prediction.wonCoffee}
											/>
										{:else}
											<!-- Show live delta and position -->
											<div class="flex flex-col items-end gap-1">
												<div class="text-xs font-medium text-gray-500 dark:text-gray-400">
													#{index + 1}
												</div>
												<div class="text-sm font-semibold {index === 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}">
													{prediction.delta !== null && prediction.delta !== undefined ? `Off by ${prediction.delta}` : ''}
												</div>
											</div>
										{/if}
									{/if}
								</div>

								{#if editingPredictionId === prediction.id}
									<!-- Edit Mode -->
									<form
										method="POST"
										action="?/editPrediction"
										use:enhance={() => {
											return async ({ update }) => {
												await update();
												cancelEditPrediction();
											};
										}}
									>
										<input type="hidden" name="predictionId" value={prediction.id} />
										<input type="hidden" name="groupId" value={data.groupId} />

										<div class="grid grid-cols-2 gap-4 text-sm mb-3">
											<div>
												<div class="text-gray-500 dark:text-gray-400 mb-1">{data.game.homeTeam}</div>
												<input
													type="number"
													name="homeScore"
													bind:value={editHomeScore}
													required
													min="0"
													class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-lg font-bold dark:bg-gray-700 dark:text-gray-100"
												/>
											</div>
											<div>
												<div class="text-gray-500 dark:text-gray-400 mb-1">{data.game.awayTeam}</div>
												<input
													type="number"
													name="awayScore"
													bind:value={editAwayScore}
													required
													min="0"
													class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-lg font-bold dark:bg-gray-700 dark:text-gray-100"
												/>
											</div>
										</div>

										<div class="flex gap-2">
											<button
												type="submit"
												class="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
											>
												Save
											</button>
											<button
												type="button"
												on:click={cancelEditPrediction}
												class="flex-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-md transition-colors"
											>
												Cancel
											</button>
										</div>
									</form>
								{:else}
									<!-- Display Mode -->
									<div class="grid grid-cols-2 gap-4 text-sm">
										<div>
											<div class="text-gray-500 dark:text-gray-400">{data.game.homeTeam}</div>
											<div class="text-lg font-bold text-gray-900 dark:text-gray-100">
												{prediction.homeScore}
											</div>
										</div>
										<div>
											<div class="text-gray-500 dark:text-gray-400">{data.game.awayTeam}</div>
											<div class="text-lg font-bold text-gray-900 dark:text-gray-100">
												{prediction.awayScore}
											</div>
										</div>
									</div>

									{#if data.isAdmin && !data.gameStarted}
										<div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
											<button
												type="button"
												on:click={() => startEditPrediction(prediction.id, prediction.homeScore, prediction.awayScore)}
												class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
											>
												<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
												</svg>
												Edit prediction
											</button>
										</div>
									{/if}
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{:else if data.gameStarted && data.predictions.length === 0}
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center border border-gray-200 dark:border-gray-700">
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
								d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
							/>
						</svg>
					</div>
					<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
						No predictions yet
					</h3>
					<p class="text-gray-500 dark:text-gray-400">
						Be the first to make a prediction for this game!
					</p>
				</div>
			{/if}
		</div>

		<!-- Sidebar -->
		<div class="space-y-6">
			<!-- Prediction Status -->
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
				<h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-3">Prediction Status</h3>
				<div class="space-y-2">
					{#each data.memberStatus as member}
						<div class="flex items-center justify-between text-sm">
							<div class="flex items-center gap-2">
								<UserAvatar name={member.user.name} mugshotUrl={member.user.mugshotUrl} size="xs" />
								<span class="text-gray-900 dark:text-gray-100">{member.user.name}</span>
							</div>
							{#if member.hasPredicted}
								<svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
							{:else}
								<svg class="w-5 h-5 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							{/if}
						</div>
					{/each}
				</div>
				<div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
					{data.memberStatus.filter(m => m.hasPredicted).length} of {data.memberStatus.length} predicted
				</div>
			</div>

			<!-- Game Info -->
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
				<h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-3">Game Info</h3>
				<dl class="space-y-2 text-sm">
					<div>
						<dt class="text-gray-500 dark:text-gray-400">Season</dt>
						<dd class="text-gray-900 dark:text-gray-100 font-medium">{data.game.season}</dd>
					</div>
					<div>
						<dt class="text-gray-500 dark:text-gray-400">Status</dt>
						<dd class="text-gray-900 dark:text-gray-100 font-medium">
							<GameStatus status={data.game.status} />
						</dd>
					</div>
					{#if data.predictions.length > 0}
						<div>
							<dt class="text-gray-500 dark:text-gray-400">Total Predictions</dt>
							<dd class="text-gray-900 dark:text-gray-100 font-medium">
								{data.predictions.length}
							</dd>
						</div>
					{/if}
				</dl>
			</div>

			<!-- Betting Odds (if available) -->
			{#if data.game.oddsSource}
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
					<h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-3">Odds</h3>
					<div class="text-sm text-gray-600 dark:text-gray-400">
						{@html data.game.oddsSource}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
