import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Toggles the admin "view as member" preference and bounces back.
 *
 * Lives in an endpoint rather than the handle hook because cookies set in a hook
 * are dropped when that hook throws a redirect.
 */
export const GET: RequestHandler = ({ url, cookies }) => {
	const mode = url.searchParams.get('av') === 'off' ? 'off' : 'on';

	cookies.set('av', mode, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 30
	});

	// Only same-site paths, so ?back= can't be used to bounce users off-site.
	const back = url.searchParams.get('back');
	throw redirect(303, back && /^\/(?!\/)/.test(back) ? back : '/');
};
