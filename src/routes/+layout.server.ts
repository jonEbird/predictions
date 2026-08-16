import type { LayoutServerLoad } from './$types';
import { getGroupSeasons, isUserGroupAdmin } from '$lib/server/queries/groups';
import { DEFAULT_GROUP_SLUG } from '$lib/config';

export const load: LayoutServerLoad = async ({ locals }) => {
	let isAdmin = false;

	if (locals.user) {
		// Check if user is admin of the default group (latest season)
		const seasons = await getGroupSeasons(DEFAULT_GROUP_SLUG);
		if (seasons.length > 0) {
			const latestSeason = seasons[0].season;
			// Get group ID from slug and season
			const { getGroupBySlugAndSeason } = await import('$lib/server/queries/groups');
			const group = await getGroupBySlugAndSeason(DEFAULT_GROUP_SLUG, latestSeason);
			if (group) {
				isAdmin = await isUserGroupAdmin(locals.user.id, group.id);
			}
		}
	}

	return {
		user: locals.user || null,
		// isAdmin drives inline admin UI, so it respects the "view as member"
		// toggle. isAdminUser is the real capability, used to render the toggle
		// itself and to keep the /admin route reachable.
		isAdmin: isAdmin && !locals.viewAsMember,
		isAdminUser: isAdmin,
		viewAsMember: Boolean(locals.viewAsMember)
	};
};
