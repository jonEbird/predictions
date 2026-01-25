<svelte:head>
	<title>Predictions App</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
	<div class="max-w-md w-full">
		<div class="text-center mb-8">
			<h1 class="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
				Predictions
			</h1>
			<p class="text-gray-600 dark:text-gray-400">
				Make predictions, compete with friends, win prizes!
			</p>
		</div>

		<div class="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-8 border border-gray-200 dark:border-gray-700">
			<div class="space-y-4">
				<p class="text-gray-700 dark:text-gray-300 text-center">
					Welcome! Please login to start making predictions.
				</p>

				<div class="flex flex-col gap-3">
					<a
						href="/login"
						class="w-full flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors"
					>
						Login
					</a>
				</div>
			</div>
		</div>

		<div class="mt-8 text-center">
			<div class="text-sm text-gray-600 dark:text-gray-400">
				<p class="mb-2">Features:</p>
				<ul class="space-y-1">
					<li>📊 Track game predictions</li>
					<li>🏆 Compete with friends</li>
					<li>☕ Win prizes</li>
					<li>📈 View detailed stats</li>
				</ul>
			</div>
		</div>
	</div>
</div>
