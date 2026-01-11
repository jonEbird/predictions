<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';

	export let data: PageData;
	export let form: ActionData;

	let isCreatingGame = false;
	let isSendingEmail = false;
	let isSendingSMS = false;
	let editingGameId: number | null = null;

	// Form state for creating games
	let newGame = {
		homeTeam: data.group.homeTeam || '',
		awayTeam: '',
		gameTime: '',
		season: new Date().getFullYear()
	};

	// Form state for editing games
	let editGame = {
		id: 0,
		homeTeam: '',
		awayTeam: '',
		gameTime: '',
		status: 'scheduled',
		homeScore: '',
		awayScore: ''
	};

	function startEditGame(game: any) {
		editingGameId = game.id;
		editGame = {
			id: game.id,
			homeTeam: game.homeTeam,
			awayTeam: game.awayTeam,
			gameTime: new Date(game.gameTime).toISOString().slice(0, 16),
			status: game.status,
			homeScore: game.homeScore?.toString() || '',
			awayScore: game.awayScore?.toString() || ''
		};
	}

	function cancelEdit() {
		editingGameId = null;
	}

	function formatDateTime(date: Date) {
		return new Date(date).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	function getStatusBadgeClass(status: string) {
		switch (status) {
			case 'scheduled':
				return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
			case 'live':
				return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
			case 'finished':
				return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
			case 'canceled':
				return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}
</script>

<svelte:head>
	<title>Admin Panel | Predictions</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Header -->
	<div class="mb-8">
		<div class="flex items-center justify-between mb-4">
			<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Admin Panel</h1>
			<a
				href="/"
				class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
			>
				← Back to Games
			</a>
		</div>
		<p class="text-gray-600 dark:text-gray-400">
			Manage games and send messages to group members
		</p>
		<div class="mt-4">
			<a
				href="/admin/cron"
				class="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md transition-colors"
			>
				<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				Manage Scheduled Jobs
			</a>
		</div>
	</div>

	<!-- Success/Error Messages -->
	{#if form?.success}
		<div class="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
			<p class="text-green-800 dark:text-green-200">{form.message}</p>
			{#if form.emailPreview}
				<div class="mt-2 text-sm text-green-700 dark:text-green-300">
					<p class="font-semibold">Email Preview:</p>
					<p>To: {form.emailPreview.recipients.join(', ')}</p>
					<p>Subject: {form.emailPreview.subject}</p>
				</div>
			{/if}
			{#if form.smsPreview}
				<div class="mt-2 text-sm text-green-700 dark:text-green-300">
					<p class="font-semibold">SMS Preview:</p>
					<p>To: {form.smsPreview.recipients.join(', ')}</p>
				</div>
			{/if}
		</div>
	{:else if form?.message}
		<div class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
			<p class="text-red-800 dark:text-red-200">{form.message}</p>
		</div>
	{/if}

	<!-- Game Management Section -->
	<div class="mb-12 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
		<h2 class="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Game Management</h2>

		<!-- Create New Game Form -->
		<div class="mb-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
			<h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Create New Game</h3>
			<form
				method="POST"
				action="?/createGame"
				use:enhance={() => {
					isCreatingGame = true;
					return async ({ update }) => {
						await update();
						isCreatingGame = false;
						// Reset form on success
						if (form?.success) {
							newGame = {
								homeTeam: data.group.homeTeam || '',
								awayTeam: '',
								gameTime: '',
								season: new Date().getFullYear()
							};
						}
					};
				}}
			>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label for="homeTeam" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Home Team
						</label>
						<input
							type="text"
							id="homeTeam"
							name="homeTeam"
							bind:value={newGame.homeTeam}
							required
							class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
						/>
					</div>

					<div>
						<label for="awayTeam" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Away Team
						</label>
						<input
							type="text"
							id="awayTeam"
							name="awayTeam"
							bind:value={newGame.awayTeam}
							required
							class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
						/>
					</div>

					<div>
						<label for="gameTime" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Game Time
						</label>
						<input
							type="datetime-local"
							id="gameTime"
							name="gameTime"
							bind:value={newGame.gameTime}
							required
							class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
						/>
					</div>

					<div>
						<label for="season" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Season
						</label>
						<input
							type="number"
							id="season"
							name="season"
							bind:value={newGame.season}
							required
							class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
						/>
					</div>
				</div>

				<div class="mt-4">
					<button
						type="submit"
						disabled={isCreatingGame}
						class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-md transition-colors"
					>
						{isCreatingGame ? 'Creating...' : 'Create Game'}
					</button>
				</div>
			</form>
		</div>

		<!-- Games List -->
		<div>
			<h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">All Games</h3>
			{#if data.games.length === 0}
				<p class="text-gray-500 dark:text-gray-400">No games created yet.</p>
			{:else}
				<div class="space-y-4">
					{#each data.games as game}
						<div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
							{#if editingGameId === game.id}
								<!-- Edit Form -->
								<form
									method="POST"
									action="?/updateGame"
									use:enhance={() => {
										return async ({ update }) => {
											await update();
											if (form?.success) {
												editingGameId = null;
											}
										};
									}}
								>
									<input type="hidden" name="gameId" value={editGame.id} />

									<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
										<div>
											<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
												Home Team
											</label>
											<input
												type="text"
												name="homeTeam"
												bind:value={editGame.homeTeam}
												required
												class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
											/>
										</div>

										<div>
											<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
												Away Team
											</label>
											<input
												type="text"
												name="awayTeam"
												bind:value={editGame.awayTeam}
												required
												class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
											/>
										</div>

										<div>
											<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
												Game Time
											</label>
											<input
												type="datetime-local"
												name="gameTime"
												bind:value={editGame.gameTime}
												required
												class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
											/>
										</div>

										<div>
											<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
												Status
											</label>
											<select
												name="status"
												bind:value={editGame.status}
												required
												class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
											>
												<option value="scheduled">Scheduled</option>
												<option value="live">Live</option>
												<option value="finished">Finished</option>
												<option value="canceled">Canceled</option>
											</select>
										</div>

										<div>
											<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
												Home Score
											</label>
											<input
												type="number"
												name="homeScore"
												bind:value={editGame.homeScore}
												placeholder="Leave empty if not finished"
												class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
											/>
										</div>

										<div>
											<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
												Away Score
											</label>
											<input
												type="number"
												name="awayScore"
												bind:value={editGame.awayScore}
												placeholder="Leave empty if not finished"
												class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
											/>
										</div>
									</div>

									<div class="flex gap-2">
										<button
											type="submit"
											class="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
										>
											Save Changes
										</button>
										<button
											type="button"
											on:click={cancelEdit}
											class="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
										>
											Cancel
										</button>
									</div>
								</form>
							{:else}
								<!-- Display Mode -->
								<div class="flex items-center justify-between">
									<div class="flex-1">
										<div class="flex items-center gap-2 mb-2">
											<h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
												{game.homeTeam} vs {game.awayTeam}
											</h4>
											<span class="text-xs px-2 py-1 rounded-full {getStatusBadgeClass(game.status)}">
												{game.status}
											</span>
										</div>
										<p class="text-sm text-gray-600 dark:text-gray-400">
											{formatDateTime(game.gameTime)}
										</p>
										{#if game.homeScore !== null && game.awayScore !== null}
											<p class="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
												Score: {game.homeTeam} {game.homeScore} - {game.awayScore} {game.awayTeam}
											</p>
										{/if}
									</div>
									<button
										on:click={() => startEditGame(game)}
										class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
									>
										Edit
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Messaging Section -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Email Form -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
			<h2 class="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Send Email</h2>

			<form
				method="POST"
				action="?/sendEmail"
				use:enhance={() => {
					isSendingEmail = true;
					return async ({ update }) => {
						await update();
						isSendingEmail = false;
					};
				}}
			>
				<div class="space-y-4">
					<div>
						<label for="emailSubject" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Subject
						</label>
						<input
							type="text"
							id="emailSubject"
							name="subject"
							required
							class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
						/>
					</div>

					<div>
						<label for="emailMessage" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Message
						</label>
						<textarea
							id="emailMessage"
							name="message"
							rows="6"
							required
							class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
						></textarea>
					</div>

					<div>
						<label for="emailRecipients" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Recipients
						</label>
						<select
							id="emailRecipients"
							name="recipients"
							required
							class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
						>
							<option value="all">All members with email notifications</option>
							<option value="betting">Only betting members with email notifications</option>
						</select>
					</div>

					<button
						type="submit"
						disabled={isSendingEmail}
						class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-md transition-colors"
					>
						{isSendingEmail ? 'Sending...' : 'Send Email'}
					</button>
				</div>
			</form>
		</div>

		<!-- SMS Form -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
			<h2 class="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Send SMS</h2>

			<!-- Dev Mode Warning -->
			<div class="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
				<p class="text-sm text-yellow-800 dark:text-yellow-200">
					<span class="font-semibold">🧪 Development Mode:</span> SMS will only be sent to your phone number for testing.
				</p>
			</div>

			<form
				method="POST"
				action="?/sendSMS"
				use:enhance={() => {
					isSendingSMS = true;
					return async ({ update }) => {
						await update();
						isSendingSMS = false;
					};
				}}
			>
				<div class="space-y-4">
					<div>
						<label for="smsMessage" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Message
						</label>
						<textarea
							id="smsMessage"
							name="message"
							rows="4"
							required
							maxlength="160"
							class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
						></textarea>
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
							Maximum 160 characters for SMS
						</p>
					</div>

					<div>
						<label for="smsRecipients" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Recipients
						</label>
						<select
							id="smsRecipients"
							name="recipients"
							required
							class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
						>
							<option value="all">All members with SMS notifications</option>
							<option value="betting">Only betting members with SMS notifications</option>
						</select>
					</div>

					<button
						type="submit"
						disabled={isSendingSMS}
						class="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-md transition-colors"
					>
						{isSendingSMS ? 'Sending...' : 'Send SMS'}
					</button>
				</div>
			</form>
		</div>
	</div>

	<!-- Member Statistics -->
	<div class="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
		<h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Group Members</h2>
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each data.members as member}
				<div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
					<p class="font-semibold text-gray-900 dark:text-gray-100">{member.name}</p>
					<p class="text-sm text-gray-600 dark:text-gray-400">{member.email}</p>
					<div class="mt-2 flex flex-wrap gap-2">
						{#if member.betting}
							<span class="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
								Betting
							</span>
						{/if}
						{#if member.emailNotifications}
							<span class="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
								Email
							</span>
						{/if}
						{#if member.smsNotifications && member.phoneNumber}
							<span class="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded">
								SMS
							</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
