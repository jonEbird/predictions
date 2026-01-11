import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, createSession, setSessionCookie } from '$lib/server/auth';

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const name = formData.get('name')?.toString();
		const email = formData.get('email')?.toString();
		const password = formData.get('password')?.toString();
		const phone = formData.get('phone')?.toString();

		// Validation
		if (!name || !email || !password) {
			return fail(400, { message: 'Name, email, and password are required' });
		}

		if (password.length < 8) {
			return fail(400, { message: 'Password must be at least 8 characters' });
		}

		// Check if user already exists
		const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

		if (existingUser) {
			return fail(400, { message: 'An account with this email already exists' });
		}

		// Hash password
		const passwordHash = await hashPassword(password);

		// Create user
		const [newUser] = await db
			.insert(users)
			.values({
				name,
				email,
				passwordHash,
				phoneNumber: phone || null,
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning();

		// Create session
		const sessionToken = createSession(newUser.id);
		setSessionCookie(event, sessionToken);

		throw redirect(303, '/');
	}
};
