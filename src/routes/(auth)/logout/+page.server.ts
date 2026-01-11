import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { deleteSessionCookie } from '$lib/server/auth';

export const actions: Actions = {
	default: async (event) => {
		deleteSessionCookie(event);
		throw redirect(303, '/login');
	}
};
