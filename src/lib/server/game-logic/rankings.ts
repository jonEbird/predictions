import { formatET, easternAbbreviation } from '$lib/datetime';

export interface ScoreLine {
	homeScore: number;
	awayScore: number;
}

export interface RankablePrediction extends ScoreLine {
	id?: number;
	delta?: number | null;
	createdAt?: Date | string | number | null;
}

/**
 * Calculate the delta (total points off) for a prediction
 */
export function calculateDelta(prediction: ScoreLine, actualScore: ScoreLine): number {
	return Math.abs(actualScore.homeScore - prediction.homeScore) +
	       Math.abs(actualScore.awayScore - prediction.awayScore);
}

/**
 * Determine if a prediction picked the correct winner
 */
export function pickedCorrectWinner(prediction: ScoreLine, actualScore: ScoreLine): boolean {
	return sideOf(actualScore) === sideOf(prediction);
}

function sideOf({ homeScore, awayScore }: ScoreLine): 'home' | 'away' | 'tie' {
	if (homeScore > awayScore) return 'home';
	if (homeScore < awayScore) return 'away';
	return 'tie';
}

function deltaOf(prediction: RankablePrediction, actualScore: ScoreLine): number {
	return prediction.delta ?? calculateDelta(prediction, actualScore);
}

function submittedAt(prediction: RankablePrediction): number {
	if (prediction.createdAt === null || prediction.createdAt === undefined) {
		// A pick with no timestamp can't claim to be first.
		return Number.MAX_SAFE_INTEGER;
	}
	return new Date(prediction.createdAt).getTime();
}

/**
 * Order two predictions for a finished game, best first.
 *
 * Every game has exactly one winner, so this has to be a total order:
 * 1. Lower delta (total points off)
 * 2. Picked the correct winner
 * 3. Whoever locked in their pick first
 * 4. Prediction id, so a stubborn tie at least renders the same way every time
 */
export function comparePredictions<T extends RankablePrediction>(
	a: T,
	b: T,
	actualScore: ScoreLine
): number {
	const deltaA = deltaOf(a, actualScore);
	const deltaB = deltaOf(b, actualScore);
	if (deltaA !== deltaB) return deltaA - deltaB;

	const aPickedWinner = pickedCorrectWinner(a, actualScore);
	const bPickedWinner = pickedCorrectWinner(b, actualScore);
	if (aPickedWinner !== bPickedWinner) return aPickedWinner ? -1 : 1;

	const submittedA = submittedAt(a);
	const submittedB = submittedAt(b);
	if (submittedA !== submittedB) return submittedA - submittedB;

	return (a.id ?? 0) - (b.id ?? 0);
}

/**
 * Sort predictions best-first for a finished game. Returns the input untouched
 * when the game has no score yet.
 */
export function sortPredictions<T extends RankablePrediction>(
	predictions: T[],
	game: { homeScore: number | null; awayScore: number | null }
): T[] {
	if (game.homeScore === null || game.awayScore === null) {
		return predictions; // Can't sort if game isn't finished
	}

	const actualScore = { homeScore: game.homeScore, awayScore: game.awayScore };
	return predictions.slice().sort((a, b) => comparePredictions(a, b, actualScore));
}

/**
 * Determine coffee winner from a list of predictions
 * Returns the user ID of the winner (first place among betters)
 */
export function determineCoffeeWinner<T extends RankablePrediction & { userId: number }>(
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

export interface NamedPrediction extends RankablePrediction {
	id: number;
	name: string;
}

function tiebreakReason<T extends NamedPrediction>(
	higher: T,
	lower: T,
	actualScore: ScoreLine
): string {
	if (pickedCorrectWinner(higher, actualScore) && !pickedCorrectWinner(lower, actualScore)) {
		return 'picked the winning side';
	}

	const submitted = submittedAt(higher);
	if (submitted < submittedAt(lower) && submitted !== Number.MAX_SAFE_INTEGER) {
		const stamp = `${formatET(submitted, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		})} ${easternAbbreviation(submitted)}`;
		return `locked in the pick first, at ${stamp}`;
	}

	return 'was entered first';
}

/**
 * Explain, per prediction, why identical picks didn't land on the same rank.
 *
 * Only players who tied on delta get a note — everyone else is separated by the
 * score itself and needs no explanation. `ordered` must already be sorted by
 * `sortPredictions`.
 */
export function tiebreakNotes<T extends NamedPrediction>(
	ordered: T[],
	game: { homeScore: number | null; awayScore: number | null }
): Map<number, string> {
	const notes = new Map<number, string>();
	if (game.homeScore === null || game.awayScore === null) return notes;

	const actualScore = { homeScore: game.homeScore, awayScore: game.awayScore };

	for (let start = 0; start < ordered.length; ) {
		const delta = deltaOf(ordered[start], actualScore);
		let end = start + 1;
		while (end < ordered.length && deltaOf(ordered[end], actualScore) === delta) end++;

		const tied = ordered.slice(start, end);
		if (tied.length > 1) {
			const [leader, runnerUp] = tied;
			const others = tied.slice(1).map((p) => p.name);
			notes.set(
				leader.id,
				`Tied at ${delta} off with ${listNames(others)}. ` +
					`${leader.name} ranks higher — ${tiebreakReason(leader, runnerUp, actualScore)}.`
			);

			for (let i = 1; i < tied.length; i++) {
				const above = tied[i - 1];
				notes.set(
					tied[i].id,
					`Tied at ${delta} off with ${above.name}. ` +
						`${above.name} ranks higher — ${tiebreakReason(above, tied[i], actualScore)}.`
				);
			}
		}

		start = end;
	}

	return notes;
}

function listNames(names: string[]): string {
	if (names.length <= 1) return names[0] ?? '';
	if (names.length === 2) return `${names[0]} and ${names[1]}`;
	return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export interface StandingsEntry {
	coffeeWins: number;
	avgDelta: number | null;
}

/**
 * Season standings order: coffee wins first, accuracy as the tiebreak.
 *
 * Members with nothing scored yet have a null average and sort to the bottom
 * rather than tying for the lead on zero wins.
 */
export function compareStandings(a: StandingsEntry, b: StandingsEntry): number {
	if (a.coffeeWins !== b.coffeeWins) return b.coffeeWins - a.coffeeWins;

	if (a.avgDelta === null && b.avgDelta === null) return 0;
	if (a.avgDelta === null) return 1;
	if (b.avgDelta === null) return -1;

	return a.avgDelta - b.avgDelta;
}

/**
 * Sort season standings and stamp each entry with an Olympic rank: players who
 * are dead even share a place, and the next place skips (1, 1, 3).
 *
 * The sort is stable, so entries the comparator considers equal stay in the
 * order they arrived — pass them in a deterministic order (by name).
 */
export function rankStandings<T extends StandingsEntry>(entries: T[]): Array<T & { rank: number }> {
	const sorted = entries.slice().sort(compareStandings);

	let rank = 0;
	return sorted.map((entry, index) => {
		if (index === 0 || compareStandings(sorted[index - 1], entry) !== 0) {
			rank = index + 1;
		}
		return { ...entry, rank };
	});
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
