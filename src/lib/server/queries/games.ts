import { db } from '$lib/db';
import { games, groupGames, predictions, users } from '$lib/db/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';

/**
 * Get upcoming games for a specific group
 */
export async function getUpcomingGames(groupId: number, limit = 10) {
	return await db
		.select({
			game: games,
			predictionCount: sql<number>`(
				SELECT COUNT(*)
				FROM ${predictions} p
				WHERE p.game_id = ${games.id}
				AND p.group_id = ${groupId}
			)`
		})
		.from(groupGames)
		.innerJoin(games, eq(groupGames.gameId, games.id))
		.where(
			and(
				eq(groupGames.groupId, groupId),
				sql`${games.gameTime} > unixepoch()`,
				eq(games.status, 'scheduled')
			)
		)
		.orderBy(asc(games.gameTime))
		.limit(limit);
}

/**
 * Get a game by ID with all related data
 */
export async function getGameById(gameId: number) {
	const result = await db.select().from(games).where(eq(games.id, gameId)).limit(1);

	return result[0] || null;
}

/**
 * Get a game with all predictions for a specific group
 */
export async function getGameWithPredictions(gameId: number, groupId: number) {
	const game = await getGameById(gameId);
	if (!game) return null;

	// Get all predictions for this game in this group
	const gamePredictions = await db
		.select({
			prediction: predictions,
			user: users
		})
		.from(predictions)
		.innerJoin(users, eq(predictions.userId, users.id))
		.where(and(eq(predictions.gameId, gameId), eq(predictions.groupId, groupId)))
		.orderBy(asc(predictions.rank));

	return {
		game,
		predictions: gamePredictions
	};
}

/**
 * Check if a user has already predicted for a game
 */
export async function hasUserPredicted(userId: number, gameId: number, groupId: number): Promise<boolean> {
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

	return result.length > 0;
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
 * Get all finished games for a group
 */
export async function getFinishedGames(groupId: number) {
	return await db
		.select({
			game: games
		})
		.from(groupGames)
		.innerJoin(games, eq(groupGames.gameId, games.id))
		.where(and(eq(groupGames.groupId, groupId), eq(games.status, 'finished')))
		.orderBy(desc(games.gameTime));
}

/**
 * Get games that are currently live (started but not finished)
 */
export async function getLiveGames(groupId: number) {
	return await db
		.select({
			game: games
		})
		.from(groupGames)
		.innerJoin(games, eq(groupGames.gameId, games.id))
		.where(
			and(
				eq(groupGames.groupId, groupId),
				sql`${games.gameTime} <= unixepoch()`,
				eq(games.status, 'live')
			)
		)
		.orderBy(desc(games.gameTime));
}

/**
 * Check if a game has started
 */
export async function hasGameStarted(gameId: number): Promise<boolean> {
	const game = await getGameById(gameId);
	if (!game) return false;

	const now = new Date();
	return game.gameTime <= now;
}

/**
 * Get groups that a game belongs to
 */
export async function getGameGroups(gameId: number) {
	return await db
		.select({
			groupId: groupGames.groupId
		})
		.from(groupGames)
		.where(eq(groupGames.gameId, gameId));
}
