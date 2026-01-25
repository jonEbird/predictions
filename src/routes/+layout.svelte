<script lang="ts">
	import '../app.css';
	import type { LayoutData } from './$types';
	import { SITE_NAME } from '$lib/config';

	export let data: LayoutData;
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
	<!-- Navigation -->
	<nav class="bg-white dark:bg-gray-800 shadow-lg border-b-2 border-gray-200 dark:border-gray-700 sticky top-0 z-50 backdrop-blur-sm bg-white/95 dark:bg-gray-800/95">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between h-16">
				<div class="flex items-center gap-6">
					<a href="/" class="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent hover:scale-105 transition-transform">
						{SITE_NAME}
					</a>
					{#if data.user && data.isAdmin}
						<a
							href="/admin"
							class="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:shadow-md"
						>
							⚙️ Admin
						</a>
					{/if}
				</div>

				<div class="flex items-center gap-4">
					{#if data.user}
						<a
							href="/profile"
							class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
						>
							👤 {data.user.name}
						</a>
						<form method="POST" action="/logout">
							<button
								type="submit"
								class="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 dark:from-gray-600 dark:to-gray-700 dark:hover:from-gray-500 dark:hover:to-gray-600 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
							>
								Logout
							</button>
						</form>
					{:else}
						<a
							href="/login"
							class="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-500 dark:hover:to-blue-600 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
						>
							Login
						</a>
					{/if}
				</div>
			</div>
		</div>
	</nav>

	<!-- Main Content -->
	<slot />
</div>
