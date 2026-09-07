import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword, createSession, setSessionCookie } from '$lib/server/auth';
import {
	loginCooldownRemaining,
	recordFailedLogin,
	clearFailedLogins,
	describeCooldown
} from '$lib/server/login-throttle';

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString();
		const password = formData.get('password')?.toString();

		if (!email || !password) {
			return fail(400, { message: 'Email and password are required' });
		}

		const cooldown = loginCooldownRemaining(email, event.getClientAddress());
		if (cooldown > 0) {
			return fail(429, {
				message: `Too many failed attempts. Try again in ${describeCooldown(cooldown)}.`
			});
		}

		// Find user by email
		const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

		// A missing user and a wrong password are reported identically, so the form
		// can't be used to find out who has an account.
		const validPassword = user ? await verifyPassword(password, user.passwordHash) : false;

		if (!user || !validPassword) {
			const owed = recordFailedLogin(email, event.getClientAddress());
			return fail(400, {
				message: owed > 0
					? `Invalid email or password. Too many failed attempts -- try again in ${describeCooldown(owed)}.`
					: 'Invalid email or password'
			});
		}

		clearFailedLogins(email, event.getClientAddress());

		// Create session
		const sessionToken = await createSession(user.id);
		setSessionCookie(event, sessionToken);

		// Update last login
		await db
			.update(users)
			.set({ lastLoginAt: new Date() })
			.where(eq(users.id, user.id));

		// Return them to where they were headed, so a deep link into a game's
		// prediction page survives the login detour. Only same-site paths are
		// honoured, so ?redirectTo= can't be used to bounce users off-site.
		const requested = event.url.searchParams.get('redirectTo');
		const target = requested && /^\/(?!\/)/.test(requested) ? requested : '/';

		throw redirect(303, target);
	}
};
