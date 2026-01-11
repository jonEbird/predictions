import { db } from '$lib/db';
import { groups, memberships, users, games, groupGames, predictions } from '$lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

/**
 * Get all groups that a user belongs to
 */
export async function getUserGroups(userId: number) {
	return await db
		.select({
			group: groups,
			membership: memberships,
			memberCount: sql<number>`(
				SELECT COUNT(*)
				FROM ${memberships} m2
				WHERE m2.group_id = ${groups.id}
			)`,
			upcomingGamesCount: sql<number>`(
				SELECT COUNT(*)
				FROM ${groupGames} gg
				JOIN ${games} g ON gg.game_id = g.id
				WHERE gg.group_id = ${groups.id}
				AND g.game_time > unixepoch()
				AND g.status = 'scheduled'
			)`
		})
		.from(memberships)
		.innerJoin(groups, eq(memberships.groupId, groups.id))
		.where(eq(memberships.userId, userId))
		.orderBy(desc(groups.season));
}

/**
 * Get a specific group by slug and season
 */
export async function getGroupBySlugAndSeason(slug: string, season: number) {
	const result = await db
		.select()
		.from(groups)
		.where(and(eq(groups.slug, slug), eq(groups.season, season)))
		.limit(1);

	return result[0] || null;
}

/**
 * Get a group with all its games for a specific season
 */
export async function getGroupWithGames(slug: string, season: number) {
	// First get the group
	const group = await getGroupBySlugAndSeason(slug, season);
	if (!group) return null;

	// Get all games for this group
	const groupGamesList = await db
		.select({
			game: games,
			predictionCount: sql<number>`(
				SELECT COUNT(*)
				FROM ${predictions} p
				WHERE p.game_id = ${games.id}
				AND p.group_id = ${group.id}
			)`
		})
		.from(groupGames)
		.innerJoin(games, eq(groupGames.gameId, games.id))
		.where(eq(groupGames.groupId, group.id))
		.orderBy(desc(games.gameTime));

	// For each game, get the winners (those who won coffee)
	const gamesWithWinners = await Promise.all(
		groupGamesList.map(async (gameItem) => {
			if (gameItem.game.status === 'finished') {
				const winners = await db
					.select({
						user: users
					})
					.from(predictions)
					.innerJoin(users, eq(predictions.userId, users.id))
					.where(
						and(
							eq(predictions.gameId, gameItem.game.id),
							eq(predictions.groupId, group.id),
							eq(predictions.wonCoffee, true)
						)
					);

				return {
					...gameItem,
					winners: winners.map((w) => w.user)
				};
			}

			return {
				...gameItem,
				winners: []
			};
		})
	);

	return {
		group,
		games: gamesWithWinners
	};
}

/**
 * Get all seasons for a specific group slug
 */
export async function getGroupSeasons(slug: string) {
	return await db
		.select({
			season: groups.season
		})
		.from(groups)
		.where(eq(groups.slug, slug))
		.orderBy(desc(groups.season));
}

/**
 * Get leaderboard for a specific group
 * Calculates total coffee wins and shows members ranked
 */
export async function getGroupLeaderboard(groupId: number) {
	const leaderboard = await db
		.select({
			user: users,
			membership: memberships,
			coffeeWins: sql<number>`(
				SELECT COUNT(*)
				FROM ${predictions} p
				WHERE p.user_id = ${users.id}
				AND p.group_id = ${groupId}
				AND p.won_coffee = 1
			)`,
			totalPredictions: sql<number>`(
				SELECT COUNT(*)
				FROM ${predictions} p
				WHERE p.user_id = ${users.id}
				AND p.group_id = ${groupId}
			)`,
			avgDelta: sql<number>`(
				SELECT AVG(p.delta)
				FROM ${predictions} p
				JOIN ${games} g ON p.game_id = g.id
				WHERE p.user_id = ${users.id}
				AND p.group_id = ${groupId}
				AND g.status = 'finished'
				AND p.delta IS NOT NULL
			)`
		})
		.from(memberships)
		.innerJoin(users, eq(memberships.userId, users.id))
		.where(eq(memberships.groupId, groupId))
		.orderBy(
			desc(sql<number>`(
				SELECT COUNT(*)
				FROM ${predictions} p
				WHERE p.user_id = ${users.id}
				AND p.group_id = ${groupId}
				AND p.won_coffee = 1
			)`)
		);

	return leaderboard;
}

/**
 * Check if a user is a member of a group
 */
export async function isUserMemberOfGroup(userId: number, groupId: number): Promise<boolean> {
	const result = await db
		.select()
		.from(memberships)
		.where(and(eq(memberships.userId, userId), eq(memberships.groupId, groupId)))
		.limit(1);

	return result.length > 0;
}

/**
 * Check if a user is the owner or admin of a group
 */
export async function isUserGroupAdmin(userId: number, groupId: number): Promise<boolean> {
	const group = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);

	if (!group[0]) return false;

	// Check if user is the owner
	if (group[0].ownerId === userId) return true;

	// Check if user has admin role in membership
	const membership = await db
		.select()
		.from(memberships)
		.where(and(eq(memberships.userId, userId), eq(memberships.groupId, groupId)))
		.limit(1);

	return membership[0]?.role === 'admin';
}

/**
 * Get all members of a group
 */
export async function getGroupMembers(groupId: number) {
	return await db
		.select({
			user: users,
			membership: memberships
		})
		.from(memberships)
		.innerJoin(users, eq(memberships.userId, users.id))
		.where(eq(memberships.groupId, groupId))
		.orderBy(users.name);
}
