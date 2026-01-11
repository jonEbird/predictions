import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const load: PageServerLoad = async ({ locals }) => {
	// Require authentication
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	return {
		user: locals.user
	};
};

export const actions: Actions = {
	updateProfile: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Not authenticated' });
		}

		const formData = await request.formData();
		const nickname = formData.get('nickname') as string;
		const emailNotifications = formData.get('emailNotifications') === 'on';
		const smsNotifications = formData.get('smsNotifications') === 'on';

		try {
			await db
				.update(users)
				.set({
					nickname: nickname || null,
					emailNotifications,
					smsNotifications,
					updatedAt: new Date()
				})
				.where(eq(users.id, locals.user.id));

			return { success: true, message: 'Profile updated successfully' };
		} catch (error) {
			console.error('Error updating profile:', error);
			return fail(500, { message: 'Failed to update profile' });
		}
	},

	changePassword: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Not authenticated' });
		}

		const formData = await request.formData();
		const currentPassword = formData.get('currentPassword') as string;
		const newPassword = formData.get('newPassword') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		// Validation
		if (!currentPassword || !newPassword || !confirmPassword) {
			return fail(400, { message: 'All password fields are required' });
		}

		if (newPassword !== confirmPassword) {
			return fail(400, { message: 'New passwords do not match' });
		}

		if (newPassword.length < 6) {
			return fail(400, { message: 'New password must be at least 6 characters' });
		}

		try {
			// Get current user with password hash
			const user = await db
				.select()
				.from(users)
				.where(eq(users.id, locals.user.id))
				.limit(1);

			if (!user[0]) {
				return fail(404, { message: 'User not found' });
			}

			// Verify current password
			const validPassword = await bcrypt.compare(currentPassword, user[0].passwordHash);
			if (!validPassword) {
				return fail(400, { message: 'Current password is incorrect' });
			}

			// Hash new password
			const newPasswordHash = await bcrypt.hash(newPassword, 10);

			// Update password
			await db
				.update(users)
				.set({
					passwordHash: newPasswordHash,
					updatedAt: new Date()
				})
				.where(eq(users.id, locals.user.id));

			return { success: true, message: 'Password changed successfully' };
		} catch (error) {
			console.error('Error changing password:', error);
			return fail(500, { message: 'Failed to change password' });
		}
	}
};
