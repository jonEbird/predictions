import cron, { type ScheduledTask } from 'node-cron';
import { CronExpressionParser } from 'cron-parser';
import { db } from '$lib/db';
import { cronJobs } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// Store active cron jobs in memory
const activeJobs = new Map<number, ScheduledTask>();

// Job handler types
type JobHandler = () => Promise<void>;
const jobHandlers = new Map<string, JobHandler>();

/**
 * Register a job handler for a specific job type
 */
export function registerJobHandler(jobType: string, handler: JobHandler) {
	jobHandlers.set(jobType, handler);
	console.log(`📋 Registered cron job handler: ${jobType}`);
}

/**
 * Calculate next run time based on cron schedule
 */
function calculateNextRun(schedule: string): Date {
	try {
		// Use 5-field cron format (no seconds) to match node-cron
		const interval = CronExpressionParser.parse(schedule, {
			currentDate: new Date(),
			tz: 'America/New_York' // Adjust timezone as needed
		});
		return interval.next().toDate();
	} catch (error) {
		console.error('Error calculating next run time:', error);
		// Fallback: return 1 minute from now
		const now = new Date();
		now.setMinutes(now.getMinutes() + 1);
		return now;
	}
}

/**
 * Start a single cron job
 */
export async function startCronJob(jobId: number): Promise<boolean> {
	try {
		// Get job from database
		const job = await db
			.select()
			.from(cronJobs)
			.where(eq(cronJobs.id, jobId))
			.limit(1);

		if (!job[0]) {
			console.error(`❌ Cron job ${jobId} not found`);
			return false;
		}

		const jobConfig = job[0];

		if (!jobConfig.enabled) {
			console.log(`⏸️  Cron job ${jobId} (${jobConfig.name}) is disabled, skipping`);
			return false;
		}

		// Stop existing job if running
		if (activeJobs.has(jobId)) {
			activeJobs.get(jobId)?.stop();
			activeJobs.delete(jobId);
		}

		// Get job handler
		const handler = jobHandlers.get(jobConfig.jobType);
		if (!handler) {
			console.error(`❌ No handler registered for job type: ${jobConfig.jobType}`);
			return false;
		}

		// Validate cron schedule
		if (!cron.validate(jobConfig.schedule)) {
			console.error(`❌ Invalid cron schedule: ${jobConfig.schedule}`);
			await db
				.update(cronJobs)
				.set({
					lastStatus: 'error',
					lastError: `Invalid cron schedule: ${jobConfig.schedule}`,
					updatedAt: new Date()
				})
				.where(eq(cronJobs.id, jobId));
			return false;
		}

		// Create the scheduled task
		const task = cron.schedule(jobConfig.schedule, async () => {
			console.log(`🔄 Running cron job: ${jobConfig.name}`);
			const startTime = Date.now();

			try {
				// Run the job handler
				await handler();

				// Update job status
				await db
					.update(cronJobs)
					.set({
						lastRun: new Date(),
						nextRun: calculateNextRun(jobConfig.schedule),
						lastStatus: 'success',
						lastError: null,
						updatedAt: new Date()
					})
					.where(eq(cronJobs.id, jobId));

				const duration = Date.now() - startTime;
				console.log(`✅ Cron job completed: ${jobConfig.name} (${duration}ms)`);
			} catch (error) {
				console.error(`❌ Cron job failed: ${jobConfig.name}`, error);

				// Update job status with error
				await db
					.update(cronJobs)
					.set({
						lastRun: new Date(),
						nextRun: calculateNextRun(jobConfig.schedule),
						lastStatus: 'error',
						lastError: error instanceof Error ? error.message : 'Unknown error',
						updatedAt: new Date()
					})
					.where(eq(cronJobs.id, jobId));
			}
		});

		// Start the task
		task.start();
		activeJobs.set(jobId, task);

		// Update next run time
		await db
			.update(cronJobs)
			.set({
				nextRun: calculateNextRun(jobConfig.schedule),
				updatedAt: new Date()
			})
			.where(eq(cronJobs.id, jobId));

		console.log(`▶️  Started cron job: ${jobConfig.name} (${jobConfig.schedule})`);
		return true;
	} catch (error) {
		console.error(`❌ Failed to start cron job ${jobId}:`, error);
		return false;
	}
}

/**
 * Stop a single cron job
 */
export function stopCronJob(jobId: number): boolean {
	if (activeJobs.has(jobId)) {
		activeJobs.get(jobId)?.stop();
		activeJobs.delete(jobId);
		console.log(`⏹️  Stopped cron job: ${jobId}`);
		return true;
	}
	return false;
}

/**
 * Reload a cron job (stop and restart with new config)
 */
export async function reloadCronJob(jobId: number): Promise<boolean> {
	stopCronJob(jobId);
	return await startCronJob(jobId);
}

/**
 * Initialize all enabled cron jobs from database
 */
export async function initCronJobs(): Promise<void> {
	console.log('🔄 Initializing cron jobs...');

	try {
		// Get all enabled jobs from database
		const jobs = await db
			.select()
			.from(cronJobs)
			.where(eq(cronJobs.enabled, true));

		console.log(`📋 Found ${jobs.length} enabled cron job(s)`);

		// Start each job
		for (const job of jobs) {
			await startCronJob(job.id);
		}

		console.log('✅ Cron jobs initialized');
	} catch (error) {
		console.error('❌ Failed to initialize cron jobs:', error);
		throw error;
	}
}

/**
 * Stop all cron jobs
 */
export function stopAllCronJobs(): void {
	console.log('⏹️  Stopping all cron jobs...');
	for (const [jobId, task] of activeJobs.entries()) {
		task.stop();
		console.log(`⏹️  Stopped cron job: ${jobId}`);
	}
	activeJobs.clear();
	console.log('✅ All cron jobs stopped');
}

/**
 * Manually trigger a job (run immediately, bypassing schedule)
 */
export async function triggerJob(jobId: number): Promise<{ success: boolean; error?: string }> {
	try {
		const job = await db
			.select()
			.from(cronJobs)
			.where(eq(cronJobs.id, jobId))
			.limit(1);

		if (!job[0]) {
			return { success: false, error: 'Job not found' };
		}

		const handler = jobHandlers.get(job[0].jobType);
		if (!handler) {
			return { success: false, error: `No handler for job type: ${job[0].jobType}` };
		}

		console.log(`🎯 Manually triggering job: ${job[0].name}`);
		await handler();

		// Update last run time
		await db
			.update(cronJobs)
			.set({
				lastRun: new Date(),
				lastStatus: 'success',
				lastError: null,
				updatedAt: new Date()
			})
			.where(eq(cronJobs.id, jobId));

		console.log(`✅ Manual job trigger completed: ${job[0].name}`);
		return { success: true };
	} catch (error) {
		console.error(`❌ Manual job trigger failed:`, error);

		// Update job status with error
		await db
			.update(cronJobs)
			.set({
				lastRun: new Date(),
				lastStatus: 'error',
				lastError: error instanceof Error ? error.message : 'Unknown error',
				updatedAt: new Date()
			})
			.where(eq(cronJobs.id, jobId));

		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Get status of all cron jobs
 */
export function getCronJobsStatus(): Array<{ jobId: number; running: boolean }> {
	const status: Array<{ jobId: number; running: boolean }> = [];
	for (const [jobId] of activeJobs.entries()) {
		status.push({ jobId, running: true });
	}
	return status;
}
