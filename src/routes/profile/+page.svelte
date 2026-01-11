<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import UserAvatar from '$lib/components/UserAvatar.svelte';

	export let data: PageData;
	export let form: ActionData;

	let isUpdatingProfile = false;
	let isChangingPassword = false;
</script>

<svelte:head>
	<title>Profile | Predictions</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

	<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">Profile Settings</h1>

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

	<!-- Profile Information -->
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-200 dark:border-gray-700">
		<h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Profile Information</h2>

		<div class="flex items-center gap-6 mb-6">
			<UserAvatar name={data.user.name} mugshotUrl={data.user.mugshotUrl} size="lg" />
			<div>
				<h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
					{data.user.name}
				</h3>
				<p class="text-gray-600 dark:text-gray-400">{data.user.email}</p>
				{#if data.user.nickname}
					<p class="text-sm text-gray-500 dark:text-gray-500 mt-1">"{data.user.nickname}"</p>
				{/if}
			</div>
		</div>

		<form
			method="POST"
			action="?/updateProfile"
			use:enhance={() => {
				isUpdatingProfile = true;
				return async ({ update }) => {
					await update();
					isUpdatingProfile = false;
				};
			}}
		>
			<div class="space-y-4">
				<div>
					<label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Full Name
					</label>
					<input
						type="text"
						id="name"
						value={data.user.name}
						disabled
						class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
					/>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
						Contact an admin to change your name
					</p>
				</div>

				<div>
					<label for="nickname" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Nickname (optional)
					</label>
					<input
						type="text"
						id="nickname"
						name="nickname"
						value={data.user.nickname || ''}
						placeholder="Enter a nickname"
						class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
					/>
				</div>

				<div>
					<label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Email
					</label>
					<input
						type="email"
						id="email"
						value={data.user.email}
						disabled
						class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
					/>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
						Contact an admin to change your email
					</p>
				</div>

				<div>
					<label for="phoneNumber" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Phone Number
					</label>
					<input
						type="tel"
						id="phoneNumber"
						value={data.user.phoneNumber || 'Not set'}
						disabled
						class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
					/>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
						Contact an admin to change your phone number
					</p>
				</div>

				<div class="pt-4 border-t border-gray-200 dark:border-gray-700">
					<h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
						Notification Preferences
					</h3>

					<div class="space-y-3">
						<label class="flex items-center">
							<input
								type="checkbox"
								name="emailNotifications"
								checked={data.user.emailNotifications}
								class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
							/>
							<span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
								Email notifications for game reminders and results
							</span>
						</label>

						<label class="flex items-center">
							<input
								type="checkbox"
								name="smsNotifications"
								checked={data.user.smsNotifications}
								disabled={!data.user.phoneNumber}
								class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
							/>
							<span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
								SMS notifications
								{#if !data.user.phoneNumber}
									<span class="text-gray-500">(phone number required)</span>
								{/if}
							</span>
						</label>
					</div>
				</div>

				<div class="pt-4">
					<button
						type="submit"
						disabled={isUpdatingProfile}
						class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-md transition-colors"
					>
						{isUpdatingProfile ? 'Saving...' : 'Save Profile'}
					</button>
				</div>
			</div>
		</form>
	</div>

	<!-- Change Password -->
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
		<h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Change Password</h2>

		<form
			method="POST"
			action="?/changePassword"
			use:enhance={() => {
				isChangingPassword = true;
				return async ({ update, result }) => {
					await update();
					isChangingPassword = false;
					// Clear form on success
					if (result.type === 'success') {
						const form = document.querySelector('form[action="?/changePassword"]') as HTMLFormElement;
						form?.reset();
					}
				};
			}}
		>
			<div class="space-y-4">
				<div>
					<label for="currentPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Current Password
					</label>
					<input
						type="password"
						id="currentPassword"
						name="currentPassword"
						required
						class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
					/>
				</div>

				<div>
					<label for="newPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						New Password
					</label>
					<input
						type="password"
						id="newPassword"
						name="newPassword"
						required
						minlength="6"
						class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
					/>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
						Must be at least 6 characters
					</p>
				</div>

				<div>
					<label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Confirm New Password
					</label>
					<input
						type="password"
						id="confirmPassword"
						name="confirmPassword"
						required
						minlength="6"
						class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
					/>
				</div>

				<div class="pt-4">
					<button
						type="submit"
						disabled={isChangingPassword}
						class="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-md transition-colors"
					>
						{isChangingPassword ? 'Changing Password...' : 'Change Password'}
					</button>
				</div>
			</div>
		</form>
	</div>

	<!-- Mugshot Upload Placeholder -->
	<div class="mt-6 bg-gray-50 dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
		<h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
			Profile Picture
		</h3>
		<p class="text-sm text-gray-600 dark:text-gray-400">
			To update your profile picture, contact an administrator. Self-service upload coming soon!
		</p>
	</div>
</div>
