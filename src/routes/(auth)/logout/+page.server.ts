import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { deleteSession, deleteSessionCookie, getSessionToken } from '$lib/server/auth';

export const actions: Actions = {
	default: async (event) => {
		// Revoke the session server-side, not just in this browser -- a copy of the
		// cookie taken elsewhere stops working too.
		const sessionToken = getSessionToken(event);
		if (sessionToken) {
			await deleteSession(sessionToken);
		}

		deleteSessionCookie(event);
		throw redirect(303, '/login');
	}
};
