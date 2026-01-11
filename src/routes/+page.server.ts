import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getGroupSeasons } from '$lib/server/queries/groups';
import { DEFAULT_GROUP_SLUG } from '$lib/config';

export const load: PageServerLoad = async ({ locals }) => {
	// If user is logged in, redirect to default group with latest season
	if (locals.user) {
		// Get latest season for the default group
		const seasons = await getGroupSeasons(DEFAULT_GROUP_SLUG);
		const latestSeason = seasons.length > 0 ? seasons[0].season : new Date().getFullYear();

		throw redirect(303, `/groups/${DEFAULT_GROUP_SLUG}?season=${latestSeason}`);
	}

	return {
		user: null
	};
};
