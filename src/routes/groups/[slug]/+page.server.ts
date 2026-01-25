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

	// Get leaderboard
	const leaderboard = await getGroupLeaderboard(groupData.group.id);

	// Calculate stats preview data
	const currentLeader = leaderboard[0];
	// Only calculate user position if user is logged in
	const userPosition = locals.user
		? leaderboard.findIndex(entry => entry.user.id === locals.user!.id) + 1
		: 0;
	const coffeeLeader = [...leaderboard].sort((a, b) => b.coffeeWins - a.coffeeWins)[0];

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
			userPosition,
			coffeeLeader,
			totalPlayers: leaderboard.length
		}
	};
};
