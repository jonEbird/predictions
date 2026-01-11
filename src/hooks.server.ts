import type { Handle } from '@sveltejs/kit';
import { getSessionToken, getUserFromSession } from '$lib/server/auth';
import { initCronJobs, registerJobHandler, stopAllCronJobs } from '$lib/server/cron';
import { sendGameReminders, sendPredictionDeadlineReminders } from '$lib/server/reminders';

// Initialize cron jobs on server startup
let cronInitialized = false;

async function initializeCronSystem() {
	if (cronInitialized) return;

	console.log('🚀 Initializing cron system...');

	try {
		// Register job handlers
		registerJobHandler('game_reminders', sendGameReminders);
		registerJobHandler('prediction_reminders', sendPredictionDeadlineReminders);

		// Initialize cron jobs from database
		await initCronJobs();

		cronInitialized = true;
		console.log('✅ Cron system initialized');
	} catch (error) {
		console.error('❌ Failed to initialize cron system:', error);
	}
}

// Initialize on module load
initializeCronSystem();

// Cleanup on process exit
process.on('SIGTERM', () => {
	console.log('Received SIGTERM, stopping cron jobs...');
	stopAllCronJobs();
	process.exit(0);
});

process.on('SIGINT', () => {
	console.log('Received SIGINT, stopping cron jobs...');
	stopAllCronJobs();
	process.exit(0);
});

/**
 * Hooks run on every request
 * This hook checks for authentication and adds user to locals
 */
export const handle: Handle = async ({ event, resolve }) => {
	const sessionToken = getSessionToken(event);

	if (sessionToken) {
		const user = await getUserFromSession(sessionToken);
		if (user) {
			event.locals.user = user;
		}
	}

	return resolve(event);
};

