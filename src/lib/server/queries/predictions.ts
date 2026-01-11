import { db } from '$lib/db';
import { predictions, games, users, memberships } from '$lib/db/schema';
import { eq, and, sql, desc, asc } from 'drizzle-orm';
import type { NewPrediction } from '$lib/db/schema';

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
 * Calculate rankings for a finished game
 * This updates the rank, delta, and wonCoffee fields for all predictions
 */
export async function calculateRankings(gameId: number, groupId: number) {
	// Get the game final score
	const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);

	if (!game[0] || game[0].homeScore === null || game[0].awayScore === null) {
		throw new Error('Game has no final score');
	}

	const finalHomeScore = game[0].homeScore;
	const finalAwayScore = game[0].awayScore;

	// Get all predictions for this game
	const allPredictions = await db
		.select({
			prediction: predictions,
			user: users,
			membership: memberships
		})
		.from(predictions)
		.innerJoin(users, eq(predictions.userId, users.id))
		.innerJoin(
			memberships,
			and(eq(memberships.userId, users.id), eq(memberships.groupId, groupId))
		)
		.where(and(eq(predictions.gameId, gameId), eq(predictions.groupId, groupId)));

	// Calculate delta and determine if they picked the winner
	const predictionsWithDelta = allPredictions.map((p) => {
		const delta =
			Math.abs(finalHomeScore - p.prediction.homeScore) +
			Math.abs(finalAwayScore - p.prediction.awayScore);

		// Did they pick the correct winner?
		const actualWinner =
			finalHomeScore > finalAwayScore ? 'home' : finalHomeScore < finalAwayScore ? 'away' : 'tie';
		const predictedWinner =
			p.prediction.homeScore > p.prediction.awayScore
				? 'home'
				: p.prediction.homeScore < p.prediction.awayScore
					? 'away'
					: 'tie';
		const pickedWinner = actualWinner === predictedWinner;

		return {
			...p,
			delta,
			pickedWinner,
			isBetting: p.membership.betting
		};
	});

	// Sort by delta (lower is better), then by picked winner, then by betting status
	predictionsWithDelta.sort((a, b) => {
		// First, sort by delta
		if (a.delta !== b.delta) return a.delta - b.delta;

		// If delta is tied, those who picked the winner rank higher
		if (a.pickedWinner && !b.pickedWinner) return -1;
		if (!a.pickedWinner && b.pickedWinner) return 1;

		return 0;
	});

	// Find first place among betters (for coffee winner)
	let coffeeWinnerId: number | null = null;
	for (const p of predictionsWithDelta) {
		if (p.isBetting) {
			coffeeWinnerId = p.prediction.id;
			break;
		}
	}

	// Update each prediction with rank, delta, and wonCoffee
	for (let i = 0; i < predictionsWithDelta.length; i++) {
		const p = predictionsWithDelta[i];

		await db
			.update(predictions)
			.set({
				rank: i + 1,
				delta: p.delta,
				wonCoffee: p.prediction.id === coffeeWinnerId,
				updatedAt: new Date()
			})
			.where(eq(predictions.id, p.prediction.id));
	}

	return predictionsWithDelta.length;
}

/**
 * Get all predictions by a user across all games
 */
export async function getUserPredictions(userId: number, groupId?: number) {
	const query = db
		.select({
			prediction: predictions,
			game: games
		})
		.from(predictions)
		.innerJoin(games, eq(predictions.gameId, games.id))
		.where(eq(predictions.userId, userId))
		.orderBy(desc(games.gameTime));

	if (groupId) {
		return await query.where(and(eq(predictions.userId, userId), eq(predictions.groupId, groupId)));
	}

	return await query;
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
