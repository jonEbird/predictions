import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, createSession, setSessionCookie } from '$lib/server/auth';

// Only admins can access registration page
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	// Check if user is admin
	const isAdmin = await db.query.users.findFirst({
		where: eq(users.id, locals.user.id),
		columns: { id: true }
	});

	// For now, only user ID 1 (first user) is admin
	// TODO: Add proper admin role to users table
	if (locals.user.id !== 1) {
		throw redirect(303, '/');
	}

	return {};
};

export const actions: Actions = {
	default: async (event) => {
		// Verify admin again on form submission
		if (!event.locals.user || event.locals.user.id !== 1) {
			return fail(403, { message: 'Only admins can register new users' });
		}

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
		await db
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

		// Don't auto-login the new user, redirect admin back to home
		throw redirect(303, '/');
	}
};
