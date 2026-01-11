import { db } from '$lib/db';
import { games, predictions, users, memberships, groups, groupGames } from '$lib/db/schema';
import { eq, and, gte, lte, isNull } from 'drizzle-orm';
import { sendBulkEmail, createEmailTemplate } from './email';
import { sendPersonalizedSMS } from './sms';
import { DEFAULT_GROUP_SLUG } from '$lib/config';

/**
 * Get upcoming games that need reminders (games in the next 48 hours without predictions)
 */
async function getUpcomingGames(groupId: number) {
	const now = new Date();
	const twoDaysFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

	const upcomingGames = await db
		.select({
			game: games
		})
		.from(groupGames)
		.innerJoin(games, eq(groupGames.gameId, games.id))
		.where(
			and(
				eq(groupGames.groupId, groupId),
				eq(games.status, 'scheduled'),
				gte(games.gameTime, now),
				lte(games.gameTime, twoDaysFromNow)
			)
		);

	return upcomingGames.map(g => g.game);
}

/**
 * Get members who haven't made predictions for a game
 */
async function getMembersWithoutPredictions(gameId: number, groupId: number) {
	// Get all group members
	const allMembers = await db
		.select({
			user: users,
			membership: memberships
		})
		.from(memberships)
		.innerJoin(users, eq(memberships.userId, users.id))
		.where(eq(memberships.groupId, groupId));

	// Get members who have already predicted
	const predictedMembers = await db
		.select({ userId: predictions.userId })
		.from(predictions)
		.where(and(eq(predictions.gameId, gameId), eq(predictions.groupId, groupId)));

	const predictedUserIds = new Set(predictedMembers.map(p => p.userId));

	// Return members who haven't predicted
	return allMembers.filter(m => !predictedUserIds.has(m.user.id));
}

/**
 * Calculate urgency level based on time until game
 */
function getUrgencyLevel(gameTime: Date): 'gentle' | 'moderate' | 'urgent' {
	const hoursUntilGame = (gameTime.getTime() - Date.now()) / (1000 * 60 * 60);

	if (hoursUntilGame > 24) return 'gentle';
	if (hoursUntilGame > 6) return 'moderate';
	return 'urgent';
}

/**
 * Get reminder message based on urgency
 */
function getReminderMessage(urgency: 'gentle' | 'moderate' | 'urgent'): string {
	const messages = {
		gentle: [
			'Game coming up! Got a prediction?',
			'Time to make your prediction!',
			'Don\'t forget to predict!',
			'Game day is approaching!',
			'Make your pick soon!'
		],
		moderate: [
			'Game is tomorrow! Time to predict!',
			'Don\'t wait too long to predict!',
			'Better get that prediction in!',
			'Tick tock! Make your prediction!',
			'Game\'s coming up quick!'
		],
		urgent: [
			'LAST CHANCE to predict!',
			'Game is TODAY! Predict NOW!',
			'Hurry! Game starts soon!',
			'Final call for predictions!',
			'It\'s now or never!'
		]
	};

	const messageList = messages[urgency];
	return messageList[Math.floor(Math.random() * messageList.length)];
}

/**
 * Send game reminders for all upcoming games
 * This is the main job handler that gets called by cron
 */
export async function sendGameReminders(): Promise<void> {
	console.log('🏈 Running game reminders job...');

	try {
		// Get the default group (for now, we'll use the latest season)
		const allGroups = await db
			.select()
			.from(groups)
			.where(eq(groups.slug, DEFAULT_GROUP_SLUG))
			.orderBy(groups.season);

		if (allGroups.length === 0) {
			console.log('No groups found, skipping reminders');
			return;
		}

		// Use the latest season's group
		const group = allGroups[allGroups.length - 1];

		// Get upcoming games
		const upcomingGames = await getUpcomingGames(group.id);

		if (upcomingGames.length === 0) {
			console.log('No upcoming games, skipping reminders');
			return;
		}

		console.log(`Found ${upcomingGames.length} upcoming game(s)`);

		// Process each game
		for (const game of upcomingGames) {
			const membersWithoutPredictions = await getMembersWithoutPredictions(game.id, group.id);

			if (membersWithoutPredictions.length === 0) {
				console.log(`All members have predicted for ${game.homeTeam} vs ${game.awayTeam}`);
				continue;
			}

			console.log(
				`Sending reminders to ${membersWithoutPredictions.length} member(s) for ${game.homeTeam} vs ${game.awayTeam}`
			);

			const urgency = getUrgencyLevel(game.gameTime);
			const reminderMsg = getReminderMessage(urgency);

			// Format game time
			const gameTimeStr = game.gameTime.toLocaleString('en-US', {
				weekday: 'long',
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				hour12: true
			});

			// Send emails
			const emailRecipients = membersWithoutPredictions
				.filter(m => m.user.emailNotifications)
				.map(m => m.user.email);

			if (emailRecipients.length > 0) {
				const emailBody = `
					<p>${reminderMsg}</p>
					<h2>${game.homeTeam} vs ${game.awayTeam}</h2>
					<p><strong>Game Time:</strong> ${gameTimeStr}</p>
					<p>Make your prediction now before it's too late!</p>
					<p><a href="https://predictions.yourdomain.com" style="display: inline-block; padding: 10px 20px; background-color: #bb0000; color: white; text-decoration: none; border-radius: 5px;">Make Prediction</a></p>
				`;

				const { html, text } = createEmailTemplate({
					title: `Reminder: ${game.homeTeam} vs ${game.awayTeam}`,
					body: emailBody,
					footerText: `${group.name} | Buckeye Predictions`
				});

				await sendBulkEmail({
					recipients: emailRecipients,
					subject: `🏈 Game Reminder: ${game.homeTeam} vs ${game.awayTeam}`,
					html,
					text
					// Note: No adminEmail filtering for scheduled jobs - they should send to everyone
				});

				console.log(`📧 Sent ${emailRecipients.length} reminder email(s)`);
			}

			// Send SMS
			const smsRecipients = membersWithoutPredictions.filter(
				m => m.user.smsNotifications && m.user.phoneNumber
			);

			if (smsRecipients.length > 0) {
				const smsMessages = smsRecipients.map(m => ({
					phone: m.user.phoneNumber!,
					message: `${reminderMsg} ${game.homeTeam} vs ${game.awayTeam} on ${gameTimeStr}. Make your prediction!`
				}));

				await sendPersonalizedSMS({
					messages: smsMessages
					// Note: No adminPhone filtering for scheduled jobs - they should send to everyone
				});

				console.log(`📱 Sent ${smsRecipients.length} reminder SMS`);
			}
		}

		console.log('✅ Game reminders completed');
	} catch (error) {
		console.error('❌ Error sending game reminders:', error);
		throw error;
	}
}

/**
 * Send prediction deadline reminders (escalating urgency throughout the day)
 * This version checks the current time and sends appropriate urgency level
 */
export async function sendPredictionDeadlineReminders(): Promise<void> {
	console.log('⏰ Running prediction deadline reminders job...');

	// This is similar to sendGameReminders but focuses on games happening TODAY or TOMORROW
	// and escalates urgency based on current time

	try {
		const allGroups = await db
			.select()
			.from(groups)
			.where(eq(groups.slug, DEFAULT_GROUP_SLUG))
			.orderBy(groups.season);

		if (allGroups.length === 0) {
			console.log('No groups found, skipping reminders');
			return;
		}

		const group = allGroups[allGroups.length - 1];

		// Get games happening today or tomorrow (through end of tomorrow)
		const now = new Date();
		const endOfTomorrow = new Date(now);
		endOfTomorrow.setDate(endOfTomorrow.getDate() + 2); // Go to day after tomorrow
		endOfTomorrow.setHours(0, 0, 0, 0); // Set to midnight (start of day after tomorrow)

		const todaysGames = await db
			.select({
				game: games
			})
			.from(groupGames)
			.innerJoin(games, eq(groupGames.gameId, games.id))
			.where(
				and(
					eq(groupGames.groupId, group.id),
					eq(games.status, 'scheduled'),
					gte(games.gameTime, now),
					lte(games.gameTime, endOfTomorrow)
				)
			);

		if (todaysGames.length === 0) {
			console.log('No games today or tomorrow, skipping deadline reminders');
			return;
		}

		for (const { game } of todaysGames) {
			const membersWithoutPredictions = await getMembersWithoutPredictions(game.id, group.id);

			if (membersWithoutPredictions.length === 0) {
				continue;
			}

			const urgency = getUrgencyLevel(game.gameTime);

			// Only send if urgency is moderate or urgent (don't spam with gentle reminders)
			if (urgency === 'gentle') {
				continue;
			}

			console.log(
				`Sending ${urgency} deadline reminders to ${membersWithoutPredictions.length} member(s)`
			);

			const reminderMsg = getReminderMessage(urgency);

			// Send SMS only (quicker, more urgent for deadline reminders)
			const smsRecipients = membersWithoutPredictions.filter(
				m => m.user.smsNotifications && m.user.phoneNumber
			);

			if (smsRecipients.length > 0) {
				const hoursUntil = Math.round((game.gameTime.getTime() - now.getTime()) / (1000 * 60 * 60));
				const smsMessages = smsRecipients.map(m => ({
					phone: m.user.phoneNumber!,
					message: `${reminderMsg} ${game.homeTeam} vs ${game.awayTeam} in ${hoursUntil}h. Predict NOW!`
				}));

				await sendPersonalizedSMS({
					messages: smsMessages
				});

				console.log(`📱 Sent ${smsRecipients.length} deadline SMS`);
			}
		}

		console.log('✅ Prediction deadline reminders completed');
	} catch (error) {
		console.error('❌ Error sending deadline reminders:', error);
		throw error;
	}
}
