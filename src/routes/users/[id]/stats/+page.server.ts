import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { users, predictions, games, memberships } from '$lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const userId = parseInt(params.id, 10);
	const groupId = parseInt(url.searchParams.get('groupId') || '0', 10);

	if (!groupId) {
		throw error(400, 'Group ID is required');
	}

	// Get the user
	const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

	if (!user[0]) {
		throw error(404, 'User not found');
	}

	// Get user's membership info
	const membership = await db
		.select()
		.from(memberships)
		.where(and(eq(memberships.userId, userId), eq(memberships.groupId, groupId)))
		.limit(1);

	if (!membership[0]) {
		throw error(404, 'User is not a member of this group');
	}

	// Get all predictions for this user in this group
	const userPredictions = await db
		.select({
			prediction: predictions,
			game: games
		})
		.from(predictions)
		.innerJoin(games, eq(predictions.gameId, games.id))
		.where(and(eq(predictions.userId, userId), eq(predictions.groupId, groupId)))
		.orderBy(sql`${games.gameTime} DESC`);

	// Calculate stats
	const finishedPredictions = userPredictions.filter((p) => p.game.status === 'finished');

	const stats = {
		totalPredictions: userPredictions.length,
		coffeeWins: finishedPredictions.filter((p) => p.prediction.wonCoffee).length,
		firstPlace: finishedPredictions.filter((p) => p.prediction.rank === 1).length,
		topThree: finishedPredictions.filter((p) => p.prediction.rank && p.prediction.rank <= 3).length,
		perfectPredictions: finishedPredictions.filter((p) => p.prediction.delta === 0).length,
		avgDelta:
			finishedPredictions.length > 0
				? finishedPredictions.reduce((sum, p) => sum + (p.prediction.delta || 0), 0) /
				  finishedPredictions.length
				: null,
		bestDelta: finishedPredictions.length > 0
			? Math.min(...finishedPredictions.map((p) => p.prediction.delta || Infinity))
			: null,
		worstDelta: finishedPredictions.length > 0
			? Math.max(...finishedPredictions.map((p) => p.prediction.delta || 0))
			: null
	};

	// Get best and worst predictions
	const bestPredictions = [...finishedPredictions]
		.sort((a, b) => (a.prediction.delta || 0) - (b.prediction.delta || 0))
		.slice(0, 5);

	const worstPredictions = [...finishedPredictions]
		.sort((a, b) => (b.prediction.delta || 0) - (a.prediction.delta || 0))
		.slice(0, 5);

	return {
		user: user[0],
		membership: membership[0],
		predictions: userPredictions,
		stats,
		bestPredictions,
		worstPredictions
	};
};
