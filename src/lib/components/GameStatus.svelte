<script lang="ts">
	export let status: string | null | undefined = 'scheduled';

	function getStatusConfig(status: string | null | undefined) {
		const statusValue = status || 'scheduled';
		switch (statusValue) {
			case 'scheduled':
				return {
					label: 'Scheduled',
					color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border-blue-300 dark:border-blue-700',
					icon: '📅'
				};
			case 'live':
				return {
					label: 'Live',
					color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 border-green-300 dark:border-green-700 animate-pulse',
					icon: '🔴'
				};
			case 'finished':
				return {
					label: 'Final',
					color: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300 border-gray-300 dark:border-gray-600',
					icon: '✓'
				};
			case 'canceled':
				return {
					label: 'Canceled',
					color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border-red-300 dark:border-red-700',
					icon: '✕'
				};
			default:
				return {
					label: status,
					color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-200 border-gray-300 dark:border-gray-600',
					icon: ''
				};
		}
	}

	$: config = getStatusConfig(status);
</script>

<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm {config.color}">
	<span>{config.icon}</span>
	<span>{config.label}</span>
</span>
