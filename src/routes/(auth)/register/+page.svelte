<script lang="ts">
	import { enhance } from '$app/forms';

	let message = '';
	let errorFields: string[] = [];
</script>

<svelte:head>
	<title>Register - Predictions</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
	<div class="max-w-md w-full space-y-8">
		<div>
			<h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
				Create your account
			</h2>
		</div>

		{#if message}
			<div class="rounded-md bg-red-50 p-4">
				<p class="text-sm text-red-800">{message}</p>
			</div>
		{/if}

		<form
			method="POST"
			class="mt-8 space-y-6"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'failure') {
						message = (result.data?.message as string) || 'Registration failed';
						errorFields = (result.data?.fields as string[]) || [];
					}
					await update();
				};
			}}
		>
			<div class="rounded-md shadow-sm space-y-3">
				<div>
					<label for="name" class="block text-sm font-medium text-gray-700">Full Name</label>
					<input
						id="name"
						name="name"
						type="text"
						required
						class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
						placeholder="John Doe"
					/>
				</div>

				<div>
					<label for="email" class="block text-sm font-medium text-gray-700">Email address</label>
					<input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						required
						class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
						placeholder="john@example.com"
					/>
				</div>

				<div>
					<label for="password" class="block text-sm font-medium text-gray-700">Password</label>
					<input
						id="password"
						name="password"
						type="password"
						autocomplete="new-password"
						required
						class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
						placeholder="Minimum 8 characters"
					/>
				</div>

				<div>
					<label for="phone" class="block text-sm font-medium text-gray-700">
						Phone Number (optional)
					</label>
					<input
						id="phone"
						name="phone"
						type="tel"
						class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
						placeholder="+1234567890"
					/>
				</div>
			</div>

			<div>
				<button
					type="submit"
					class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
				>
					Register
				</button>
			</div>

			<div class="text-sm text-center">
				<a href="/login" class="font-medium text-blue-600 hover:text-blue-500">
					Already have an account? Sign in
				</a>
			</div>
		</form>
	</div>
</div>
