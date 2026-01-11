import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { games, groupGames, groups, users, memberships } from '$lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getGroupSeasons, getGroupBySlugAndSeason, isUserGroupAdmin } from '$lib/server/queries/groups';
import { DEFAULT_GROUP_SLUG } from '$lib/config';
import { sendBulkSMS } from '$lib/server/sms';
import { sendBulkEmail, createEmailTemplate } from '$lib/server/email';
import { sendGameResultNotifications } from '$lib/server/game-results';

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

	// Get all games for this season
	const allGames = await db
		.select({
			game: games
		})
		.from(groupGames)
		.innerJoin(games, eq(groupGames.gameId, games.id))
		.where(eq(groupGames.groupId, group.id))
		.orderBy(desc(games.gameTime));

	// Get all group members for messaging
	const members = await db
		.select({
			user: users,
			membership: memberships
		})
		.from(memberships)
		.innerJoin(users, eq(memberships.userId, users.id))
		.where(eq(memberships.groupId, group.id));

	return {
		group,
		games: allGames.map((g) => g.game),
		members: members.map((m) => ({ ...m.user, betting: m.membership.betting }))
	};
};

export const actions: Actions = {
	createGame: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Not authenticated' });
		}

		const formData = await request.formData();
		const homeTeam = formData.get('homeTeam') as string;
		const awayTeam = formData.get('awayTeam') as string;
		const gameTime = formData.get('gameTime') as string;
		const season = parseInt(formData.get('season') as string);

		if (!homeTeam || !awayTeam || !gameTime || !season) {
			return fail(400, { message: 'All fields are required' });
		}

		try {
			// Get the group for this season, or create it if it doesn't exist
			let group = await getGroupBySlugAndSeason(DEFAULT_GROUP_SLUG, season);

			if (!group) {
				// Get the latest season to copy settings from
				const seasons = await getGroupSeasons(DEFAULT_GROUP_SLUG);
				if (seasons.length === 0) {
					return fail(404, { message: 'No existing seasons found. Please create a group first.' });
				}

				const latestSeason = seasons[0].season;
				const latestGroup = await getGroupBySlugAndSeason(DEFAULT_GROUP_SLUG, latestSeason);

				if (!latestGroup) {
					return fail(404, { message: 'Could not find template season' });
				}

				// Verify user is admin of the latest season before creating new one
				const isAdmin = await isUserGroupAdmin(locals.user.id, latestGroup.id);
				if (!isAdmin) {
					return fail(403, { message: 'Not authorized to create new season' });
				}

				// Create new season group with same settings as latest season
				const newGroupResult = await db
					.insert(groups)
					.values({
						name: latestGroup.name,
						slug: latestGroup.slug,
						description: latestGroup.description,
						season: season,
						homeTeam: latestGroup.homeTeam,
						pictureUrl: latestGroup.pictureUrl,
						prize: latestGroup.prize,
						prizeImageUrl: latestGroup.prizeImageUrl,
						ownerId: latestGroup.ownerId
					})
					.returning();

				group = newGroupResult[0];

				// Copy all memberships from the latest season
				const latestMembers = await db
					.select()
					.from(memberships)
					.where(eq(memberships.groupId, latestGroup.id));

				if (latestMembers.length > 0) {
					await db.insert(memberships).values(
						latestMembers.map((m) => ({
							userId: m.userId,
							groupId: group.id,
							betting: m.betting,
							role: m.role
						}))
					);
				}

				console.log(`Created new season ${season} for ${DEFAULT_GROUP_SLUG}`);
			} else {
				// Verify admin access for existing group
				const isAdmin = await isUserGroupAdmin(locals.user.id, group.id);
				if (!isAdmin) {
					return fail(403, { message: 'Not authorized' });
				}
			}

			// Create the game
			const result = await db
				.insert(games)
				.values({
					homeTeam,
					awayTeam,
					gameTime: new Date(gameTime),
					season,
					status: 'scheduled'
				})
				.returning();

			const newGame = result[0];

			// Associate game with the group
			await db.insert(groupGames).values({
				groupId: group.id,
				gameId: newGame.id
			});

			return { success: true, message: 'Game created successfully' };
		} catch (error) {
			console.error('Error creating game:', error);
			return fail(500, { message: 'Failed to create game' });
		}
	},

	updateGame: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Not authenticated' });
		}

		const formData = await request.formData();
		const gameId = parseInt(formData.get('gameId') as string);
		const homeTeam = formData.get('homeTeam') as string;
		const awayTeam = formData.get('awayTeam') as string;
		const gameTime = formData.get('gameTime') as string;
		const status = formData.get('status') as string;
		const homeScore = formData.get('homeScore') as string;
		const awayScore = formData.get('awayScore') as string;

		if (!gameId || !homeTeam || !awayTeam || !gameTime || !status) {
			return fail(400, { message: 'Required fields missing' });
		}

		try {
			// Get the game to find its season and previous status
			const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
			if (!game[0]) {
				return fail(404, { message: 'Game not found' });
			}

			const previousStatus = game[0].status;

			// Verify admin access
			const group = await getGroupBySlugAndSeason(DEFAULT_GROUP_SLUG, game[0].season);
			if (!group) {
				return fail(404, { message: 'Group not found' });
			}

			const isAdmin = await isUserGroupAdmin(locals.user.id, group.id);
			if (!isAdmin) {
				return fail(403, { message: 'Not authorized' });
			}

			// Update the game
			await db
				.update(games)
				.set({
					homeTeam,
					awayTeam,
					gameTime: new Date(gameTime),
					status,
					homeScore: homeScore ? parseInt(homeScore) : null,
					awayScore: awayScore ? parseInt(awayScore) : null,
					updatedAt: new Date()
				})
				.where(eq(games.id, gameId));

			// If game was just marked as finished, send notifications
			if (status === 'finished' && previousStatus !== 'finished' && homeScore && awayScore) {
				console.log(`🏈 Game finished! Sending result notifications...`);

				// Get admin's email and phone for dev mode filtering
				const members = await db
					.select({
						user: users,
						membership: memberships
					})
					.from(memberships)
					.innerJoin(users, eq(memberships.userId, users.id))
					.where(eq(memberships.groupId, group.id));

				const adminUser = members.find(m => m.user.id === locals.user.id);
				const adminEmail = adminUser?.user.email || undefined;
				const adminPhone = adminUser?.user.phoneNumber || undefined;

				try {
					const result = await sendGameResultNotifications(
						gameId,
						group.id,
						adminEmail,
						adminPhone
					);

					console.log(`✅ Sent ${result.emailsSent} emails, ${result.smsSent} SMS`);
					if (result.errors.length > 0) {
						console.error('Some notifications failed:', result.errors);
					}

					return {
						success: true,
						message: `Game updated! Sent ${result.emailsSent} email(s) and ${result.smsSent} SMS notification(s).`
					};
				} catch (notificationError) {
					console.error('Error sending notifications:', notificationError);
					return {
						success: true,
						message: 'Game updated but notifications failed to send. Check logs for details.'
					};
				}
			}

			return { success: true, message: 'Game updated successfully' };
		} catch (error) {
			console.error('Error updating game:', error);
			return fail(500, { message: 'Failed to update game' });
		}
	},

	sendEmail: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Not authenticated' });
		}

		const formData = await request.formData();
		const subject = formData.get('subject') as string;
		const message = formData.get('message') as string;
		const recipients = formData.get('recipients') as string; // "all" or "betting"

		if (!subject || !message || !recipients) {
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

			// Get recipients based on filter
			const memberQuery = db
				.select({
					user: users,
					membership: memberships
				})
				.from(memberships)
				.innerJoin(users, eq(memberships.userId, users.id))
				.where(eq(memberships.groupId, group.id));

			const members = await memberQuery;

			const emailList = members
				.filter((m) => {
					if (recipients === 'all') return m.user.emailNotifications;
					if (recipients === 'betting') return m.membership.betting && m.user.emailNotifications;
					return false;
				})
				.map((m) => m.user.email);

			if (emailList.length === 0) {
				return fail(400, { message: 'No recipients found with email notifications enabled' });
			}

			// Get admin's email for dev mode filtering
			const adminUser = members.find(m => m.user.id === locals.user.id);
			const adminEmail = adminUser?.user.email || undefined;

			// Create email template
			const { html, text } = createEmailTemplate({
				title: subject,
				body: `<p>${message.replace(/\n/g, '<br>')}</p>`,
				footerText: `${group.name} | Buckeye Predictions`
			});

			// Send emails
			console.log(`📧 Sending email to ${emailList.length} recipients`);
			const result = await sendBulkEmail({
				recipients: emailList,
				subject,
				html,
				text,
				adminEmail
			});

			if (result.devMode && result.skipped > 0) {
				return {
					success: true,
					message: `🧪 DEV MODE: Email sent to you only (${result.skipped} others skipped for testing)`,
					emailPreview: { subject, recipients: emailList }
				};
			}

			if (result.failed > 0) {
				console.error('Some emails failed:', result.errors);
				return {
					success: true,
					message: `Email sent to ${result.sent} recipient(s). ${result.failed} failed.`,
					emailPreview: {
						subject,
						recipients: emailList,
						errors: result.errors
					}
				};
			}

			return {
				success: true,
				message: `Email successfully sent to ${result.sent} recipient(s)!`,
				emailPreview: { subject, recipients: emailList }
			};
		} catch (error) {
			console.error('Error sending email:', error);
			return fail(500, { message: 'Failed to send email' });
		}
	},

	sendSMS: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Not authenticated' });
		}

		const formData = await request.formData();
		const message = formData.get('message') as string;
		const recipients = formData.get('recipients') as string; // "all" or "betting"

		if (!message || !recipients) {
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

			// Get recipients based on filter
			const members = await db
				.select({
					user: users,
					membership: memberships
				})
				.from(memberships)
				.innerJoin(users, eq(memberships.userId, users.id))
				.where(eq(memberships.groupId, group.id));

			const phoneList = members
				.filter((m) => {
					if (!m.user.phoneNumber || !m.user.smsNotifications) return false;
					if (recipients === 'all') return true;
					if (recipients === 'betting') return m.membership.betting;
					return false;
				})
				.map((m) => m.user.phoneNumber as string);

			if (phoneList.length === 0) {
				return fail(400, { message: 'No recipients found with phone numbers and SMS enabled' });
			}

			// Get admin's phone for dev mode filtering
			const adminUser = members.find(m => m.user.id === locals.user.id);
			const adminPhone = adminUser?.user.phoneNumber || undefined;

			// Send SMS via Twilio (dev mode protection is in the SMS module)
			console.log(`📱 Sending SMS to ${phoneList.length} potential recipients`);
			const result = await sendBulkSMS({
				recipients: phoneList,
				message,
				adminPhone
			});

			if (result.devMode && result.skipped > 0) {
				return {
					success: true,
					message: `🧪 DEV MODE: SMS sent to you only (${result.skipped} others skipped for testing)`,
					smsPreview: { message, recipients: phoneList }
				};
			}

			if (result.failed > 0) {
				console.error('Some SMS messages failed:', result.errors);
				return {
					success: true,
					message: `SMS sent to ${result.sent} recipient(s). ${result.failed} failed.`,
					smsPreview: {
						message,
						recipients: phoneList,
						errors: result.errors
					}
				};
			}

			return {
				success: true,
				message: `SMS successfully sent to ${result.sent} recipient(s)!`,
				smsPreview: { message, recipients: phoneList }
			};
		} catch (error) {
			console.error('Error sending SMS:', error);
			return fail(500, { message: 'Failed to send SMS' });
		}
	}
};
