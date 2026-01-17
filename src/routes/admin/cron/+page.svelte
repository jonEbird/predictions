<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';

	export let data: PageData;
	export let form: ActionData;

	let editingJobId: number | null = null;
	let isCreatingJob = false;

	// Form state for creating jobs
	let newJob = {
		name: '',
		jobType: 'game_reminders',
		schedule: '0 12 * * *'
	};

	// Form state for editing jobs
	let editJob = {
		id: 0,
		name: '',
		schedule: '',
		enabled: true
	};

	function startEditJob(job: any) {
		editingJobId = job.id;
		editJob = {
			id: job.id,
			name: job.name,
			schedule: job.schedule,
			enabled: job.enabled
		};
	}

	function cancelEdit() {
		editingJobId = null;
	}

	function formatDateTime(date: Date | null) {
		if (!date) return 'Never';
		return new Date(date).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	function getStatusBadgeClass(job: any) {
		if (!job.enabled) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
		if (job.running) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
		return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
	}

	function getStatusText(job: any) {
		if (!job.enabled) return 'Disabled';
		if (job.running) return 'Running';
		return 'Stopped';
	}

	function getJobTypeLabel(jobType: string) {
		const labels: Record<string, string> = {
			game_reminders: 'Game Reminders',
			prediction_reminders: 'Prediction Deadline Reminders'
		};
		return labels[jobType] || jobType;
	}

	function getLastStatusBadgeClass(status: string | null) {
		if (!status) return 'bg-gray-100 text-gray-800';
		if (status === 'success') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
		return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
	}
</script>

<svelte:head>
	<title>Cron Jobs | Admin | Predictions</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Header -->
	<div class="mb-8">
		<div class="flex items-center justify-between mb-4">
			<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Scheduled Jobs (Cron)</h1>
			<a
				href="/admin"
				class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
			>
				← Back to Admin
			</a>
		</div>
		<p class="text-gray-600 dark:text-gray-400">
			Manage automated tasks like game reminders and prediction deadline notifications
		</p>
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

	<!-- Create New Job -->
	<div class="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
		<h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Create New Scheduled Job</h2>
		<form
			method="POST"
			action="?/createJob"
			use:enhance={() => {
				isCreatingJob = true;
				return async ({ update }) => {
					await update();
					isCreatingJob = false;
					if (form?.success) {
						newJob = {
							name: '',
							jobType: 'game_reminders',
							schedule: '0 12 * * *'
						};
					}
				};
			}}
		>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
				<div>
					<label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Job Name
					</label>
					<input
						type="text"
						id="name"
						name="name"
						bind:value={newJob.name}
						placeholder="Daily Game Reminders"
						required
						class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
					/>
				</div>

				<div>
					<label for="jobType" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Job Type
					</label>
					<select
						id="jobType"
						name="jobType"
						bind:value={newJob.jobType}
						required
						class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
					>
						<option value="game_reminders">Game Reminders</option>
						<option value="prediction_reminders">Prediction Deadline Reminders</option>
					</select>
				<div class="mt-2 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs">
					<p class="font-semibold text-gray-700 dark:text-gray-300 mb-1">Job Type Descriptions:</p>
					<div class="space-y-1 text-gray-600 dark:text-gray-400">
						<p><strong>Game Reminders:</strong> Gentle initial notifications for games in the next 48 hours. Run once daily (e.g., <code>0 12 * * *</code> for noon).</p>
						<p><strong>Prediction Deadline Reminders:</strong> Escalating urgent reminders for games today or tomorrow. Run multiple times daily (e.g., <code>0 */3 * * *</code> every 3 hours).</p>
					</div>
				</div>

				<div>
					<label for="schedule" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Schedule (Cron)
					</label>
					<input
						type="text"
						id="schedule"
						name="schedule"
						bind:value={newJob.schedule}
						placeholder="0 12 * * *"
						required
						class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
					/>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
						Format: minute hour day month weekday
					</p>
				</div>
			</div>

			<button
				type="submit"
				disabled={isCreatingJob}
				class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-md transition-colors"
			>
				{isCreatingJob ? 'Creating...' : 'Create Job'}
			</button>
		</form>

		<!-- Cron Help -->
		<div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
			<p class="text-sm text-blue-800 dark:text-blue-200 font-semibold mb-2">Cron Schedule Examples:</p>
			<ul class="text-xs text-blue-700 dark:text-blue-300 space-y-1">
				<li><code>0 12 * * *</code> - Every day at noon</li>
				<li><code>0 9,15 * * *</code> - Every day at 9am and 3pm</li>
				<li><code>*/30 * * * *</code> - Every 30 minutes</li>
				<li><code>0 8 * * 1</code> - Every Monday at 8am</li>
			</ul>
		</div>
	</div>

	<!-- Jobs List -->
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
		<h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Scheduled Jobs</h2>

		{#if data.jobs.length === 0}
			<p class="text-gray-500 dark:text-gray-400">No scheduled jobs yet. Create one above!</p>
		{:else}
			<div class="space-y-4">
				{#each data.jobs as job}
					<div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
						{#if editingJobId === job.id}
							<!-- Edit Form -->
							<form
								method="POST"
								action="?/updateJob"
								use:enhance={() => {
									return async ({ update }) => {
										await update();
										if (form?.success) {
											editingJobId = null;
										}
									};
								}}
							>
								<input type="hidden" name="jobId" value={editJob.id} />

								<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
									<div>
										<label for="edit-job-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
											Job Name
										</label>
										<input
											type="text"
											id="edit-job-name"
											name="name"
											bind:value={editJob.name}
											required
											class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
										/>
									</div>

									<div>
										<label for="edit-job-schedule" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
											Schedule
										</label>
										<input
											type="text"
											id="edit-job-schedule"
											name="schedule"
											bind:value={editJob.schedule}
											required
											class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
										/>
									</div>

									<div>
										<label for="edit-job-enabled" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
											Enabled
										</label>
										<select
											id="edit-job-enabled"
											name="enabled"
											bind:value={editJob.enabled}
											required
											class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
										>
											<option value={true}>Yes</option>
											<option value={false}>No</option>
										</select>
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
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<div class="flex items-center gap-2 mb-2">
										<h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
											{job.name}
										</h4>
										<span class="text-xs px-2 py-1 rounded-full {getStatusBadgeClass(job)}">
											{getStatusText(job)}
										</span>
										{#if job.lastStatus}
											<span class="text-xs px-2 py-1 rounded-full {getLastStatusBadgeClass(job.lastStatus)}">
												Last: {job.lastStatus}
											</span>
										{/if}
									</div>

									<div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
										<div>
											<span class="font-medium">Type:</span> {getJobTypeLabel(job.jobType)}
										</div>
										<div>
											<span class="font-medium">Schedule:</span> <code class="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">{job.schedule}</code>
										</div>
										<div>
											<span class="font-medium">Last Run:</span> {formatDateTime(job.lastRun)}
										</div>
										<div>
											<span class="font-medium">Next Run:</span> {formatDateTime(job.nextRun)}
										</div>
									</div>

									{#if job.lastError}
										<div class="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm">
											<span class="font-medium text-red-800 dark:text-red-200">Last Error:</span>
											<span class="text-red-700 dark:text-red-300">{job.lastError}</span>
										</div>
									{/if}
								</div>

								<div class="flex flex-col gap-2 ml-4">
									<button
										on:click={() => startEditJob(job)}
										class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
									>
										Edit
									</button>

									<form method="POST" action="?/toggleJob" use:enhance>
										<input type="hidden" name="jobId" value={job.id} />
										<input type="hidden" name="enabled" value={!job.enabled} />
										<button
											type="submit"
											class="w-full px-4 py-2 {job.enabled ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'} text-white text-sm font-medium rounded-md transition-colors"
										>
											{job.enabled ? 'Disable' : 'Enable'}
										</button>
									</form>

									<form method="POST" action="?/triggerJob" use:enhance>
										<input type="hidden" name="jobId" value={job.id} />
										<button
											type="submit"
											class="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md transition-colors"
										>
											Run Now
										</button>
									</form>

									<form method="POST" action="?/deleteJob" use:enhance>
										<input type="hidden" name="jobId" value={job.id} />
										<button
											type="submit"
											class="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
											on:click={(e) => { if (!confirm('Are you sure you want to delete this job? This cannot be undone.')) { e.preventDefault(); } }}
										>
											Delete
										</button>
									</form>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
