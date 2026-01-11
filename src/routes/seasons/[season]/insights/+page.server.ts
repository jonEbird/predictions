import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { games, predictions, users, groups, groupGames, memberships } from '$lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { getGroupBySlugAndSeason, isUserMemberOfGroup } from '$lib/server/queries/groups';
import { DEFAULT_GROUP_SLUG } from '$lib/config';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	// Require authentication
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	const season = parseInt(params.season, 10);
	const groupIdParam = url.searchParams.get('groupId');

	if (!groupIdParam) {
		throw error(400, 'Group ID is required');
	}

	const groupId = parseInt(groupIdParam, 10);

	// Get group
	const group = await getGroupBySlugAndSeason(DEFAULT_GROUP_SLUG, season);
	if (!group || group.id !== groupId) {
		throw error(404, 'Group not found');
	}

	// Check if user is a member
	const isMember = await isUserMemberOfGroup(locals.user.id, groupId);
	if (!isMember) {
		throw error(403, 'You are not a member of this group');
	}

	// Get all games for this group in this season
	const groupGamesData = await db
		.select({
			game: games,
			predictions: sql<number>`count(distinct ${predictions.id})`.as('prediction_count'),
			avgDelta: sql<number | null>`avg(${predictions.delta})`.as('avg_delta'),
			minDelta: sql<number | null>`min(${predictions.delta})`.as('min_delta'),
			maxDelta: sql<number | null>`max(${predictions.delta})`.as('max_delta')
		})
		.from(groupGames)
		.innerJoin(games, eq(groupGames.gameId, games.id))
		.leftJoin(
			predictions,
			and(eq(predictions.gameId, games.id), eq(predictions.groupId, groupId))
		)
		.where(eq(groupGames.groupId, groupId))
		.groupBy(games.id)
		.orderBy(games.gameTime);

	// Get full leaderboard with detailed stats (only count predictions from finished games with non-null delta)
	const leaderboardData = await db
		.select({
			user: users,
			totalPredictions: sql<number>`count(distinct case when ${games.status} = 'finished' and ${predictions.delta} is not null then ${predictions.id} end)`.as('total_predictions'),
			coffeeWins: sql<number>`sum(case when ${predictions.wonCoffee} = 1 then 1 else 0 end)`.as(
				'coffee_wins'
			),
			avgDelta: sql<number | null>`avg(case when ${games.status} = 'finished' and ${predictions.delta} is not null then ${predictions.delta} end)`.as('avg_delta'),
			totalDelta: sql<number | null>`sum(case when ${games.status} = 'finished' and ${predictions.delta} is not null then ${predictions.delta} end)`.as('total_delta'),
			bestDelta: sql<number | null>`min(case when ${games.status} = 'finished' and ${predictions.delta} is not null then ${predictions.delta} end)`.as('best_delta'),
			worstDelta: sql<number | null>`max(case when ${games.status} = 'finished' and ${predictions.delta} is not null then ${predictions.delta} end)`.as('worst_delta')
		})
		.from(memberships)
		.innerJoin(users, eq(memberships.userId, users.id))
		.leftJoin(
			predictions,
			and(
				eq(predictions.userId, users.id),
				eq(predictions.groupId, groupId)
			)
		)
		.leftJoin(games, eq(predictions.gameId, games.id))
		.where(eq(memberships.groupId, groupId))
		.groupBy(users.id)
		.orderBy(desc(sql`coffee_wins`), sql`avg_delta`);

	// Get game-by-game performance data for each user
	const gamePerformance = await db
		.select({
			userId: predictions.userId,
			userName: users.name,
			gameId: predictions.gameId,
			gameTime: games.gameTime,
			homeTeam: games.homeTeam,
			awayTeam: games.awayTeam,
			delta: predictions.delta,
			wonCoffee: predictions.wonCoffee
		})
		.from(predictions)
		.innerJoin(users, eq(predictions.userId, users.id))
		.innerJoin(games, eq(predictions.gameId, games.id))
		.where(eq(predictions.groupId, groupId))
		.orderBy(games.gameTime, users.name);

	// Calculate insights
	const finishedGames = groupGamesData.filter(
		(g) => g.game.status === 'finished' && g.avgDelta !== null
	);

	const hardestGame =
		finishedGames.length > 0
			? finishedGames.reduce((max, game) =>
					game.avgDelta! > (max.avgDelta || 0) ? game : max
			  )
			: null;

	const easiestGame =
		finishedGames.length > 0
			? finishedGames.reduce((min, game) =>
					game.avgDelta! < (min.avgDelta || Infinity) ? game : min
			  )
			: null;

	// Calculate participation rate
	const totalGames = groupGamesData.filter((g) => g.game.status === 'finished').length;
	const totalMembers = leaderboardData.length;

	return {
		group,
		season,
		leaderboard: leaderboardData,
		games: groupGamesData,
		gamePerformance,
		insights: {
			hardestGame,
			easiestGame,
			totalGames,
			totalMembers,
			totalPredictions: gamePerformance.length
		}
	};
};
