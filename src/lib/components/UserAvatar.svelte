<script lang="ts">
	export let name: string;
	export let mugshotUrl: string | null = null;
	export let size: 'xs' | 'sm' | 'md' | 'lg' = 'md';

	function getInitials(name: string): string {
		const parts = name.trim().split(' ');
		if (parts.length >= 2) {
			return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
		}
		return name.slice(0, 2).toUpperCase();
	}

	function getSizeClasses(size: string): string {
		switch (size) {
			case 'xs':
				return 'w-6 h-6 text-xs';
			case 'sm':
				return 'w-8 h-8 text-xs';
			case 'lg':
				return 'w-16 h-16 text-xl';
			default:
				return 'w-12 h-12 text-base';
		}
	}

	$: initials = getInitials(name);
	$: sizeClasses = getSizeClasses(size);
</script>

{#if mugshotUrl}
	<img
		src={mugshotUrl}
		alt={name}
		class="rounded-full {sizeClasses} object-cover"
	/>
{:else}
	<div
		class="rounded-full {sizeClasses} bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold"
	>
		{initials}
	</div>
{/if}
