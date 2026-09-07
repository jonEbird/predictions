import { db } from '$lib/db';
import { predictions, games, memberships } from '$lib/db/schema';
import { eq, and, sql, desc, asc } from 'drizzle-orm';
import type { NewPrediction } from '$lib/db/schema';
import { calculateDelta, sortPredictions } from '$lib/server/game-logic/rankings';

/**
 * Create a new prediction
 */
export async function createPrediction(data: NewPrediction) {
	const result = await db.insert(predictions).values(data).returning();
	return result[0];
}

/**
 * Update an existing prediction (before game starts)
 */
export async function updatePrediction(
	predictionId: number,
	homeScore: number,
	awayScore: number
) {
	const result = await db
		.update(predictions)
		.set({
			homeScore,
			awayScore,
			updatedAt: new Date()
		})
		.where(eq(predictions.id, predictionId))
		.returning();

	return result[0];
}

/**
 * Check whether every member of a group has predicted for a game
 */
export async function haveAllMembersPredicted(gameId: number, groupId: number): Promise<boolean> {
	// Aliased by hand: interpolating a column into `sql` renders it unqualified,
	// which the correlated subquery would resolve against `p` instead of `m`.
	const counts = await db.get<{ member_count: number; predicted_count: number }>(sql`
		SELECT
			COUNT(*) AS member_count,
			SUM(CASE WHEN EXISTS (
				SELECT 1
				FROM ${predictions} p
				WHERE p.game_id = ${gameId}
				AND p.group_id = ${groupId}
				AND p.user_id = m.user_id
			) THEN 1 ELSE 0 END) AS predicted_count
		FROM ${memberships} m
		WHERE m.group_id = ${groupId}
	`);

	// An empty group has nothing to reveal, so it never counts as complete.
	return counts.member_count > 0 && counts.predicted_count === counts.member_count;
}

/**
 * Get a user's prediction for a specific game
 */
export async function getUserPrediction(userId: number, gameId: number, groupId: number) {
	const result = await db
		.select()
		.from(predictions)
		.where(
			and(
				eq(predictions.userId, userId),
				eq(predictions.gameId, gameId),
				eq(predictions.groupId, groupId)
			)
		)
		.limit(1);

	return result[0] || null;
}

/**
 * Calculate rankings for a finished game.
 *
 * The single writer of rank/delta/wonCoffee: every path that finishes a game
 * goes through here so the results can't disagree with each other. Ranks are a
 * strict 1..n — a shared delta is broken by who picked the winning side and
 * then by who locked their pick in first — and at most one prediction is
 * flagged wonCoffee, because only one person collects.
 */
export async function calculateRankings(gameId: number, groupId: number) {
	// Get the game final score
	const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);

	if (!game[0] || game[0].homeScore === null || game[0].awayScore === null) {
		throw new Error('Game has no final score');
	}

	const finalScore = { homeScore: game[0].homeScore, awayScore: game[0].awayScore };

	// Get all predictions for this game
	const allPredictions = await db
		.select({
			prediction: predictions,
			membership: memberships
		})
		.from(predictions)
		.innerJoin(
			memberships,
			and(
				eq(memberships.userId, predictions.userId),
				eq(memberships.groupId, predictions.groupId)
			)
		)
		.where(and(eq(predictions.gameId, gameId), eq(predictions.groupId, groupId)));

	const ranked = sortPredictions(
		allPredictions.map((p) => ({
			id: p.prediction.id,
			homeScore: p.prediction.homeScore,
			awayScore: p.prediction.awayScore,
			createdAt: p.prediction.createdAt,
			delta: calculateDelta(p.prediction, finalScore),
			isBetting: p.membership.betting
		})),
		finalScore
	);

	// Coffee is only on the line between members who are betting this season.
	const coffeeWinnerId = ranked.find((p) => p.isBetting)?.id ?? null;

	for (let i = 0; i < ranked.length; i++) {
		const p = ranked[i];

		await db
			.update(predictions)
			.set({
				rank: i + 1,
				delta: p.delta,
				wonCoffee: p.id === coffeeWinnerId,
				updatedAt: new Date()
			})
			.where(eq(predictions.id, p.id));
	}

	return ranked.length;
}

/**
 * Get all predictions by a user across all games
 */
export async function getUserPredictions(userId: number, groupId?: number) {
	const whereConditions = groupId
		? and(eq(predictions.userId, userId), eq(predictions.groupId, groupId))
		: eq(predictions.userId, userId);

	return await db
		.select({
			prediction: predictions,
			game: games
		})
		.from(predictions)
		.innerJoin(games, eq(predictions.gameId, games.id))
		.where(whereConditions)
		.orderBy(desc(games.gameTime));
}

/**
 * Get user stats for a specific group
 */
export async function getUserStatsForGroup(userId: number, groupId: number) {
	const stats = await db
		.select({
			totalPredictions: sql<number>`COUNT(*)`,
			coffeeWins: sql<number>`SUM(CASE WHEN ${predictions.wonCoffee} = 1 THEN 1 ELSE 0 END)`,
			avgDelta: sql<number>`AVG(${predictions.delta})`,
			perfectPredictions: sql<number>`SUM(CASE WHEN ${predictions.delta} = 0 THEN 1 ELSE 0 END)`,
			firstPlaceFinishes: sql<number>`SUM(CASE WHEN ${predictions.rank} = 1 THEN 1 ELSE 0 END)`
		})
		.from(predictions)
		.innerJoin(games, eq(predictions.gameId, games.id))
		.where(
			and(
				eq(predictions.userId, userId),
				eq(predictions.groupId, groupId),
				eq(games.status, 'finished')
			)
		);

	return stats[0];
}

/**
 * Get best predictions (lowest delta) for a user
 */
export async function getUserBestPredictions(userId: number, groupId: number, limit = 5) {
	return await db
		.select({
			prediction: predictions,
			game: games
		})
		.from(predictions)
		.innerJoin(games, eq(predictions.gameId, games.id))
		.where(
			and(
				eq(predictions.userId, userId),
				eq(predictions.groupId, groupId),
				eq(games.status, 'finished'),
				sql`${predictions.delta} IS NOT NULL`
			)
		)
		.orderBy(asc(predictions.delta))
		.limit(limit);
}

/**
 * Get worst predictions (highest delta) for a user
 */
export async function getUserWorstPredictions(userId: number, groupId: number, limit = 5) {
	return await db
		.select({
			prediction: predictions,
			game: games
		})
		.from(predictions)
		.innerJoin(games, eq(predictions.gameId, games.id))
		.where(
			and(
				eq(predictions.userId, userId),
				eq(predictions.groupId, groupId),
				eq(games.status, 'finished'),
				sql`${predictions.delta} IS NOT NULL`
			)
		)
		.orderBy(desc(predictions.delta))
		.limit(limit);
}
