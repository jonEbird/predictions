/**
 * Score presentation shared by the game page and the notification emails, so a
 * prediction reads the same wherever it's shown.
 */

/**
 * Describe a predicted or final score as a winning margin: "OSU by 7".
 */
export function marginLabel(
	homeScore: number,
	awayScore: number,
	teams: { homeTeam: string; awayTeam: string }
): string {
	if (homeScore === awayScore) return 'Tie';

	return homeScore > awayScore
		? `${teams.homeTeam} by ${homeScore - awayScore}`
		: `${teams.awayTeam} by ${awayScore - homeScore}`;
}

/**
 * How far a prediction landed from the final score: "3 off", or a nod to the
 * one that didn't miss.
 */
export function deltaLabel(delta: number | null): string {
	if (delta === null) return '';
	if (delta === 0) return '🎯 Perfect!';
	return `${delta} off`;
}

/**
 * How far clear of the next-closest pick an extreme has to be before it counts
 * as an outlier. A touchdown: big enough that the group notices, small enough
 * that it still fires on a normal week.
 */
export const OUTLIER_GAP = 6;

/** Below this many picks, "the pack" isn't a pack and nobody gets called out. */
export const MIN_PICKS_FOR_OUTLIERS = 4;

export type Extreme = 'optimist' | 'pessimist';

export const EXTREME_LABELS: Record<Extreme, { emojis: string[]; label: string }> = {
	optimist: { emojis: ['😇', '🤩', '😮'], label: 'Biggest optimist' },
	pessimist: { emojis: ['😈', '😡', '👺'], label: 'Biggest pessimist' }
};

/**
 * Pick one of an extreme's faces, varying by `seed` -- pass the prediction id.
 *
 * Seeded rather than random so the same pick always draws the same face: the
 * page is server-rendered, and a fresh Math.random() on hydration would make
 * the emoji visibly flip after load. It also keeps the reveal email and the
 * site agreeing on what they showed.
 */
export function extremeEmoji(extreme: Extreme, seed: number): string {
	const { emojis } = EXTREME_LABELS[extreme];
	return emojis[Math.abs(seed) % emojis.length];
}

/**
 * A prediction's margin from our side: our team's score minus the opponent's,
 * whichever half of the matchup we happen to be.
 *
 * Null when we can't tell — the group has no team set, or its team isn't
 * playing in this game. Optimism is meaningless without a rooting interest, so
 * callers should skip the labelling entirely rather than guess a direction.
 */
export function ourMargin(
	pick: { homeScore: number; awayScore: number },
	game: { homeTeam: string; awayTeam: string },
	ourTeam: string | null | undefined
): number | null {
	if (!ourTeam) return null;
	if (game.homeTeam === ourTeam) return pick.homeScore - pick.awayScore;
	if (game.awayTeam === ourTeam) return pick.awayScore - pick.homeScore;
	return null;
}

/**
 * Flag the most and least optimistic picks in a group -- but only when they've
 * actually stuck their neck out.
 *
 * An extreme counts as an outlier only if it sits OUTLIER_GAP or more clear of
 * the next-closest pick. A week where everyone lands within a touchdown of each
 * other flags nobody, which is the point: the callout is only fun while it's
 * rare. Picks tied at an extreme cancel each other out for free, since the gap
 * between them is zero.
 *
 * Deliberately not a statistical test. With a group this small, Tukey fences
 * and standard deviations almost never fire -- and a lone extreme inflates the
 * standard deviation enough to hide itself.
 */
export function findExtremes(
	picks: Array<{ id: number; homeScore: number; awayScore: number }>,
	game: { homeTeam: string; awayTeam: string },
	ourTeam: string | null | undefined
): Map<number, Extreme> {
	const flags = new Map<number, Extreme>();

	const margins = picks
		.map((pick) => ({ id: pick.id, margin: ourMargin(pick, game, ourTeam) }))
		.filter((entry): entry is { id: number; margin: number } => entry.margin !== null)
		.sort((a, b) => a.margin - b.margin);

	if (margins.length < MIN_PICKS_FOR_OUTLIERS) return flags;

	const [lowest, secondLowest] = margins;
	if (secondLowest.margin - lowest.margin >= OUTLIER_GAP) {
		flags.set(lowest.id, 'pessimist');
	}

	const highest = margins[margins.length - 1];
	const secondHighest = margins[margins.length - 2];
	if (highest.margin - secondHighest.margin >= OUTLIER_GAP) {
		flags.set(highest.id, 'optimist');
	}

	return flags;
}
