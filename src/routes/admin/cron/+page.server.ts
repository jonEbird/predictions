import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { cronJobs, groups, memberships } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getGroupSeasons, getGroupBySlugAndSeason, isUserGroupAdmin } from '$lib/server/queries/groups';
import { DEFAULT_GROUP_SLUG } from '$lib/config';
import { reloadCronJob, triggerJob, getCronJobsStatus, stopCronJob } from '$lib/server/cron';

export const load: PageServerLoad = async ({ locals }) => {
	// Require authentication
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	// Get the latest season for the default group
	const seasons = await getGroupSeasons(DEFAULT_GROUP_SLUG);
	if (seasons.length === 0) {
		throw redirect(303, '/');
	}

	const latestSeason = seasons[0].season;
	const group = await getGroupBySlugAndSeason(DEFAULT_GROUP_SLUG, latestSeason);

	if (!group) {
		throw redirect(303, '/');
	}

	// Check if user is admin
	const isAdmin = await isUserGroupAdmin(locals.user.id, group.id);
	if (!isAdmin) {
		throw redirect(303, '/');
	}

	// Get all cron jobs
	const jobs = await db
		.select()
		.from(cronJobs)
		.orderBy(desc(cronJobs.enabled), cronJobs.id);

	// Get running status from in-memory map
	const runningStatus = getCronJobsStatus();
	const runningJobIds = new Set(runningStatus.map(s => s.jobId));

	// Combine data
	const jobsWithStatus = jobs.map(job => ({
		...job,
		running: job.enabled && runningJobIds.has(job.id)
	}));

	return {
		group,
		jobs: jobsWithStatus
	};
};

export const actions: Actions = {
	createJob: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Not authenticated' });
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const jobType = formData.get('jobType') as string;
		const schedule = formData.get('schedule') as string;

		if (!name || !jobType || !schedule) {
			return fail(400, { message: 'All fields are required' });
		}

		try {
			// Verify admin access
			const seasons = await getGroupSeasons(DEFAULT_GROUP_SLUG);
			if (seasons.length === 0) {
				return fail(404, { message: 'No seasons found' });
			}

			const group = await getGroupBySlugAndSeason(DEFAULT_GROUP_SLUG, seasons[0].season);
			if (!group) {
				return fail(404, { message: 'Group not found' });
			}

			const isAdmin = await isUserGroupAdmin(locals.user.id, group.id);
			if (!isAdmin) {
				return fail(403, { message: 'Not authorized' });
			}

			// Create job
			const result = await db
				.insert(cronJobs)
				.values({
					name,
					jobType,
					schedule,
					enabled: true
				})
				.returning();

			const newJob = result[0];

			// Start the job
			await reloadCronJob(newJob.id);

			return { success: true, message: 'Cron job created and started!' };
		} catch (error) {
			console.error('Error creating cron job:', error);
			return fail(500, { message: 'Failed to create cron job' });
		}
	},

	updateJob: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Not authenticated' });
		}

		const formData = await request.formData();
		const jobId = parseInt(formData.get('jobId') as string);
		const name = formData.get('name') as string;
		const schedule = formData.get('schedule') as string;
		const enabled = formData.get('enabled') === 'true';

		if (!jobId || !name || !schedule) {
			return fail(400, { message: 'All fields are required' });
		}

		try {
			// Verify admin access
			const seasons = await getGroupSeasons(DEFAULT_GROUP_SLUG);
			if (seasons.length === 0) {
				return fail(404, { message: 'No seasons found' });
			}

			const group = await getGroupBySlugAndSeason(DEFAULT_GROUP_SLUG, seasons[0].season);
			if (!group) {
				return fail(404, { message: 'Group not found' });
			}

			const isAdmin = await isUserGroupAdmin(locals.user.id, group.id);
			if (!isAdmin) {
				return fail(403, { message: 'Not authorized' });
			}

			// Update job
			await db
				.update(cronJobs)
				.set({
					name,
					schedule,
					enabled,
					updatedAt: new Date()
				})
				.where(eq(cronJobs.id, jobId));

			// Reload the job with new config
			await reloadCronJob(jobId);

			return { success: true, message: 'Cron job updated!' };
		} catch (error) {
			console.error('Error updating cron job:', error);
			return fail(500, { message: 'Failed to update cron job' });
		}
	},

	toggleJob: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Not authenticated' });
		}

		const formData = await request.formData();
		const jobId = parseInt(formData.get('jobId') as string);
		const enabled = formData.get('enabled') === 'true';

		if (!jobId) {
			return fail(400, { message: 'Job ID is required' });
		}

		try {
			// Verify admin access
			const seasons = await getGroupSeasons(DEFAULT_GROUP_SLUG);
			if (seasons.length === 0) {
				return fail(404, { message: 'No seasons found' });
			}

			const group = await getGroupBySlugAndSeason(DEFAULT_GROUP_SLUG, seasons[0].season);
			if (!group) {
				return fail(404, { message: 'Group not found' });
			}

			const isAdmin = await isUserGroupAdmin(locals.user.id, group.id);
			if (!isAdmin) {
				return fail(403, { message: 'Not authorized' });
			}

			// Toggle job
			await db
				.update(cronJobs)
				.set({
					enabled,
					updatedAt: new Date()
				})
				.where(eq(cronJobs.id, jobId));

			// Reload the job
			await reloadCronJob(jobId);

			return { success: true, message: `Cron job ${enabled ? 'enabled' : 'disabled'}!` };
		} catch (error) {
			console.error('Error toggling cron job:', error);
			return fail(500, { message: 'Failed to toggle cron job' });
		}
	},

	triggerJob: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Not authenticated' });
		}

		const formData = await request.formData();
		const jobId = parseInt(formData.get('jobId') as string);

		if (!jobId) {
			return fail(400, { message: 'Job ID is required' });
		}

		try {
			// Verify admin access
			const seasons = await getGroupSeasons(DEFAULT_GROUP_SLUG);
			if (seasons.length === 0) {
				return fail(404, { message: 'No seasons found' });
			}

			const group = await getGroupBySlugAndSeason(DEFAULT_GROUP_SLUG, seasons[0].season);
			if (!group) {
				return fail(404, { message: 'Group not found' });
			}

			const isAdmin = await isUserGroupAdmin(locals.user.id, group.id);
			if (!isAdmin) {
				return fail(403, { message: 'Not authorized' });
			}

			// Trigger job manually
			const result = await triggerJob(jobId);

			if (result.success) {
				return { success: true, message: 'Job triggered successfully!' };
			} else {
				return fail(500, { message: result.error || 'Failed to trigger job' });
			}
		} catch (error) {
			console.error('Error triggering cron job:', error);
			return fail(500, { message: 'Failed to trigger cron job' });
		}
	},

	deleteJob: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Not authenticated' });
		}

		const formData = await request.formData();
		const jobId = parseInt(formData.get('jobId') as string);

		if (!jobId) {
			return fail(400, { message: 'Job ID is required' });
		}

		try {
			// Verify admin access
			const seasons = await getGroupSeasons(DEFAULT_GROUP_SLUG);
			if (seasons.length === 0) {
				return fail(404, { message: 'No seasons found' });
			}

			const group = await getGroupBySlugAndSeason(DEFAULT_GROUP_SLUG, seasons[0].season);
			if (!group) {
				return fail(404, { message: 'Group not found' });
			}

			const isAdmin = await isUserGroupAdmin(locals.user.id, group.id);
			if (!isAdmin) {
				return fail(403, { message: 'Not authorized' });
			}

			// Stop the job first
			stopCronJob(jobId);

			// Delete from database
			await db.delete(cronJobs).where(eq(cronJobs.id, jobId));

			return { success: true, message: 'Cron job deleted!' };
		} catch (error) {
			console.error('Error deleting cron job:', error);
			return fail(500, { message: 'Failed to delete cron job' });
		}
	}
};
