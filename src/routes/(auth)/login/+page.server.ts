import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword, createSession, setSessionCookie } from '$lib/server/auth';

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString();
		const password = formData.get('password')?.toString();

		if (!email || !password) {
			return fail(400, { message: 'Email and password are required' });
		}

		// Find user by email
		const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

		if (!user) {
			return fail(400, { message: 'Invalid email or password' });
		}

		// Verify password
		const validPassword = await verifyPassword(password, user.passwordHash);

		if (!validPassword) {
			return fail(400, { message: 'Invalid email or password' });
		}

		// Create session
		const sessionToken = createSession(user.id);
		setSessionCookie(event, sessionToken);

		// Update last login
		await db
			.update(users)
			.set({ lastLoginAt: new Date() })
			.where(eq(users.id, user.id));

		throw redirect(303, '/');
	}
};
