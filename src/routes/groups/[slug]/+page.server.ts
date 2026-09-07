import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getGroupWithGames, getGroupLeaderboard, getGroupSeasons, isUserMemberOfGroup } from '$lib/server/queries/groups';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const { slug } = params;

	// Get season from query params or use latest
	const seasonParam = url.searchParams.get('season');
	let season: number;

	if (seasonParam) {
		season = parseInt(seasonParam, 10);
	} else {
		// Get latest season for this slug
		const seasons = await getGroupSeasons(slug);
		if (seasons.length === 0) {
			throw error(404, 'Group not found');
		}
		season = seasons[0].season;
	}

	// Get group with games
	const groupData = await getGroupWithGames(slug, season);

	if (!groupData) {
		throw error(404, 'Group not found');
	}

	// For authenticated users, check if they're a member
	if (locals.user) {
		const isMember = await isUserMemberOfGroup(locals.user.id, groupData.group.id);
		if (!isMember) {
			throw error(403, 'You are not a member of this group');
		}
	}

	// Get leaderboard (already ranked best-first)
	const leaderboard = await getGroupLeaderboard(groupData.group.id);

	// Calculate stats preview data
	const currentLeader = leaderboard[0];
	// Only calculate user position if user is logged in
	const userEntry = locals.user
		? leaderboard.find((entry) => entry.user.id === locals.user!.id)
		: undefined;
	// Coffee wins are the leaderboard's primary sort, so the leader holds the most.
	const coffeeLeader = currentLeader?.coffeeWins ? currentLeader : null;

	// Get all available seasons for this group
	const availableSeasons = await getGroupSeasons(slug);

	return {
		group: groupData.group,
		games: groupData.games,
		leaderboard,
		availableSeasons: availableSeasons.map(s => s.season),
		currentSeason: season,
		statsPreview: {
			currentLeader,
			userPosition: userEntry?.rank ?? 0,
			coffeeLeader,
			totalPlayers: leaderboard.length
		}
	};
};
