import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getGroupSeasons } from '$lib/server/queries/groups';
import { DEFAULT_GROUP_SLUG } from '$lib/config';

export const load: PageServerLoad = async ({ locals }) => {
	// Get latest season for the default group
	const seasons = await getGroupSeasons(DEFAULT_GROUP_SLUG);
	const latestSeason = seasons.length > 0 ? seasons[0].season : new Date().getFullYear();

	// Redirect all visitors (logged in or not) to the default group with latest season
	throw redirect(303, `/groups/${DEFAULT_GROUP_SLUG}?season=${latestSeason}`);
};
