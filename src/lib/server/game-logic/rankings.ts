import type { Game, Prediction } from '$lib/db/schema';

/**
 * Calculate the delta (total points off) for a prediction
 */
export function calculateDelta(
	prediction: { homeScore: number; awayScore: number },
	actualScore: { homeScore: number; awayScore: number }
): number {
	return Math.abs(actualScore.homeScore - prediction.homeScore) +
	       Math.abs(actualScore.awayScore - prediction.awayScore);
}

/**
 * Determine if a prediction picked the correct winner
 */
export function pickedCorrectWinner(
	prediction: { homeScore: number; awayScore: number },
	actualScore: { homeScore: number; awayScore: number }
): boolean {
	const actualWinner =
		actualScore.homeScore > actualScore.awayScore
			? 'home'
			: actualScore.homeScore < actualScore.awayScore
				? 'away'
				: 'tie';

	const predictedWinner =
		prediction.homeScore > prediction.awayScore
			? 'home'
			: prediction.homeScore < prediction.awayScore
				? 'away'
				: 'tie';

	return actualWinner === predictedWinner;
}

/**
 * Sort predictions by accuracy
 * Tiebreaker rules:
 * 1. Lower delta (total points off)
 * 2. Picked the correct winner
 */
export function sortPredictions<
	T extends { homeScore: number; awayScore: number; delta?: number | null }
>(predictions: T[], game: { homeScore: number | null; awayScore: number | null }): T[] {
	if (game.homeScore === null || game.awayScore === null) {
		return predictions; // Can't sort if game isn't finished
	}

	return predictions.slice().sort((a, b) => {
		// Calculate deltas if not already present
		const deltaA = a.delta ?? calculateDelta(a, { homeScore: game.homeScore!, awayScore: game.awayScore! });
		const deltaB = b.delta ?? calculateDelta(b, { homeScore: game.homeScore!, awayScore: game.awayScore! });

		// First, sort by delta (lower is better)
		if (deltaA !== deltaB) {
			return deltaA - deltaB;
		}

		// If tied, check who picked the winner
		const aPickedWinner = pickedCorrectWinner(a, { homeScore: game.homeScore!, awayScore: game.awayScore! });
		const bPickedWinner = pickedCorrectWinner(b, { homeScore: game.homeScore!, awayScore: game.awayScore! });

		if (aPickedWinner && !bPickedWinner) return -1;
		if (!aPickedWinner && bPickedWinner) return 1;

		return 0;
	});
}

/**
 * Determine coffee winner from a list of predictions
 * Returns the user ID of the winner (first place among betters)
 */
export function determineCoffeeWinner<
	T extends { userId: number; homeScore: number; awayScore: number; delta?: number | null }
>(
	predictions: T[],
	game: { homeScore: number | null; awayScore: number | null },
	bettingUserIds: number[]
): number | null {
	if (game.homeScore === null || game.awayScore === null) {
		return null; // Game not finished
	}

	// Sort predictions by accuracy
	const sorted = sortPredictions(predictions, game);

	// Find first place among betters
	for (const pred of sorted) {
		if (bettingUserIds.includes(pred.userId)) {
			return pred.userId;
		}
	}

	return null; // No betters or no predictions
}

/**
 * Get display text for a rank
 */
export function getRankDisplay(rank: number | null): string {
	if (rank === null) return '-';

	if (rank === 1) return '🥇 1st';
	if (rank === 2) return '🥈 2nd';
	if (rank === 3) return '🥉 3rd';

	// Add suffix for other ranks
	const suffix = getRankSuffix(rank);
	return `${rank}${suffix}`;
}

/**
 * Get suffix for rank number (st, nd, rd, th)
 */
function getRankSuffix(rank: number): string {
	const lastDigit = rank % 10;
	const lastTwoDigits = rank % 100;

	if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
		return 'th';
	}

	switch (lastDigit) {
		case 1:
			return 'st';
		case 2:
			return 'nd';
		case 3:
			return 'rd';
		default:
			return 'th';
	}
}

/**
 * Format delta for display
 */
export function formatDelta(delta: number | null): string {
	if (delta === null) return '-';
	if (delta === 0) return '🎯 Perfect!';
	return `${delta} off`;
}
