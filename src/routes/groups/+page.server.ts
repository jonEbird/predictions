import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserGroups } from '$lib/server/queries/groups';

export const load: PageServerLoad = async ({ locals }) => {
	// Require authentication
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	// Get all groups the user belongs to
	const userGroups = await getUserGroups(locals.user.id);

	return {
		groups: userGroups
	};
};
