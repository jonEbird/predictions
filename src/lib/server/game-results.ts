import { db } from '$lib/db';
import { games, predictions, users, memberships, groups } from '$lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { sendBulkEmail, createEmailTemplate } from './email';
import { sendPersonalizedSMS } from './sms';

interface PredictionWithUser {
	prediction: typeof predictions.$inferSelect;
	user: typeof users.$inferSelect;
	membership: typeof memberships.$inferSelect;
}

interface GameResultsData {
	game: typeof games.$inferSelect;
	group: typeof groups.$inferSelect;
	winner: PredictionWithUser;
	coffeeWinner: PredictionWithUser;
	allPredictions: PredictionWithUser[];
}

// Fun messages for winners and losers
const HAPPY_MESSAGES = [
	'High Five',
	'Niceeee',
	'Raise the roof',
	'Hot Dog!',
	'Kazaam!',
	'Great Work',
	"You're awesome",
	'How can I be like you?',
	'Help me next time',
	"It's like you're psychic",
	"Ain't life grand?",
	'W00t!'
];

const LOSER_MESSAGES = [
	'Sorry',
	'Try Again',
	'Need a friend to talk to?',
	'Ah, shucks!',
	'Darn it!',
	'Maybe Next time?',
	"Don't quit on me, though",
	'Try asking Jon next time',
	'Ice Cream cheers me up',
	'Least you have your health',
	'Try a Popsicle. Will make you happy',
	"We can't all be winners",
	'Some days you win, today you lose',
	'Beep beep'
];

function randomChoice<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Calculate delta (points off) for a prediction
 */
function calculateDelta(
	predictedHome: number,
	predictedAway: number,
	actualHome: number,
	actualAway: number
): number {
	return Math.abs(predictedHome - actualHome) + Math.abs(predictedAway - actualAway);
}

/**
 * Update prediction deltas and ranks for a finished game
 */
async function updatePredictionStats(gameId: number, groupId: number): Promise<void> {
	// Get the game scores
	const game = await db
		.select()
		.from(games)
		.where(eq(games.id, gameId))
		.limit(1);

	if (!game[0] || game[0].homeScore === null || game[0].awayScore === null) {
		throw new Error('Game scores not available');
	}

	const { homeScore: actualHome, awayScore: actualAway } = game[0];

	// Get all predictions for this game in this group
	const gamePredictions = await db
		.select()
		.from(predictions)
		.where(and(eq(predictions.gameId, gameId), eq(predictions.groupId, groupId)));

	// Calculate deltas
	const predictionsWithDeltas = gamePredictions.map((pred) => ({
		...pred,
		calculatedDelta: calculateDelta(pred.homeScore, pred.awayScore, actualHome, actualAway)
	}));

	// Sort by delta (ascending) to determine ranks
	predictionsWithDeltas.sort((a, b) => a.calculatedDelta - b.calculatedDelta);

	// Update each prediction with delta and rank
	for (let i = 0; i < predictionsWithDeltas.length; i++) {
		const pred = predictionsWithDeltas[i];
		await db
			.update(predictions)
			.set({
				delta: pred.calculatedDelta,
				rank: i + 1,
				wonCoffee: false, // Will update this next
				updatedAt: new Date()
			})
			.where(eq(predictions.id, pred.id));
	}

	// Find coffee winner (best among betting members)
	const bettingMembers = await db
		.select({
			prediction: predictions,
			membership: memberships
		})
		.from(predictions)
		.innerJoin(memberships, and(
			eq(predictions.userId, memberships.userId),
			eq(predictions.groupId, memberships.groupId)
		))
		.where(and(
			eq(predictions.gameId, gameId),
			eq(predictions.groupId, groupId),
			eq(memberships.betting, true)
		))
		.orderBy(asc(predictions.delta));

	if (bettingMembers.length > 0) {
		const coffeeWinnerId = bettingMembers[0].prediction.id;
		await db
			.update(predictions)
			.set({ wonCoffee: true })
			.where(eq(predictions.id, coffeeWinnerId));
	}
}

/**
 * Get game results data for notifications
 */
async function getGameResultsData(gameId: number, groupId: number): Promise<GameResultsData> {
	const game = await db
		.select()
		.from(games)
		.where(eq(games.id, gameId))
		.limit(1);

	if (!game[0]) {
		throw new Error('Game not found');
	}

	const group = await db
		.select()
		.from(groups)
		.where(eq(groups.id, groupId))
		.limit(1);

	if (!group[0]) {
		throw new Error('Group not found');
	}

	// Get all predictions with user and membership data
	const allPredictions = await db
		.select({
			prediction: predictions,
			user: users,
			membership: memberships
		})
		.from(predictions)
		.innerJoin(users, eq(predictions.userId, users.id))
		.innerJoin(memberships, and(
			eq(predictions.userId, memberships.userId),
			eq(predictions.groupId, memberships.groupId)
		))
		.where(and(eq(predictions.gameId, gameId), eq(predictions.groupId, groupId)))
		.orderBy(asc(predictions.rank));

	if (allPredictions.length === 0) {
		throw new Error('No predictions found for this game');
	}

	const winner = allPredictions[0]; // Best overall
	const coffeeWinner = allPredictions.find(p => p.prediction.wonCoffee) || winner;

	return {
		game: game[0],
		group: group[0],
		winner,
		coffeeWinner,
		allPredictions
	};
}

/**
 * Generate SMS message for a person
 */
function generateSMSMessage(
	person: PredictionWithUser,
	data: GameResultsData
): string {
	const { winner, coffeeWinner } = data;
	const isBetting = person.membership.betting;
	const personDelta = person.prediction.delta || 0;

	// Winner and coffee winner are the same person
	if (winner.user.id === coffeeWinner.user.id) {
		if (person.user.id === winner.user.id) {
			return `Collect your coffee! You WIN by being off by ${personDelta}! ${randomChoice(HAPPY_MESSAGES)}`;
		} else if (isBetting) {
			return `${winner.user.name} was off by ${winner.prediction.delta}, so you owe coffee. You were off by ${personDelta}. ${randomChoice(LOSER_MESSAGES)}`;
		} else {
			return `${winner.user.name} wins being ${winner.prediction.delta} off. You were ${personDelta} off. ${randomChoice(LOSER_MESSAGES)}`;
		}
	}
	// Two different winners
	else {
		if (person.user.id === winner.user.id) {
			return `Congrats! You win by being off by ${personDelta}! ${randomChoice(HAPPY_MESSAGES)}`;
		} else if (person.user.id === coffeeWinner.user.id) {
			return `${winner.user.name} wins by being ${winner.prediction.delta} off but you WIN coffee being ${personDelta} off. ${randomChoice(HAPPY_MESSAGES)}`;
		} else if (isBetting) {
			return `${winner.user.name} wins by being ${winner.prediction.delta} off and you owe ${coffeeWinner.user.name} coffee who was off ${coffeeWinner.prediction.delta}. You're off by ${personDelta}. ${randomChoice(LOSER_MESSAGES)}.`;
		} else {
			return `${winner.user.name} wins by being ${winner.prediction.delta} off and you were ${personDelta} off. ${randomChoice(LOSER_MESSAGES)}`;
		}
	}
}

/**
 * Generate email HTML for a person
 */
function generateEmailHTML(
	person: PredictionWithUser,
	data: GameResultsData
): string {
	const { game, winner, coffeeWinner, allPredictions } = data;
	const isBetting = person.membership.betting;
	const personDelta = person.prediction.delta || 0;
	const personRank = person.prediction.rank || allPredictions.length;

	let mainMessage = '';
	let congratsMessage = '';

	// Determine main message
	if (person.user.id === winner.user.id && person.user.id === coffeeWinner.user.id) {
		congratsMessage = `<p style="font-size: 24px; color: #bb0000; font-weight: bold;">🏆 CONGRATULATIONS! You WIN! 🏆</p>`;
		mainMessage = `<p>You had the best prediction, being off by only <strong>${personDelta} points</strong>!</p>`;
		if (isBetting) {
			mainMessage += `<p style="color: #bb0000; font-weight: bold;">Collect your coffee!</p>`;
		}
	} else if (person.user.id === winner.user.id) {
		congratsMessage = `<p style="font-size: 24px; color: #bb0000; font-weight: bold;">🏆 You WIN! 🏆</p>`;
		mainMessage = `<p>You had the best prediction overall, being off by only <strong>${personDelta} points</strong>!</p>`;
	} else if (person.user.id === coffeeWinner.user.id) {
		congratsMessage = `<p style="font-size: 20px; color: #bb0000; font-weight: bold;">☕ You WIN Coffee! ☕</p>`;
		mainMessage = `<p>${winner.user.name} won overall (off by ${winner.prediction.delta}), but you won coffee among betting members by being off by only <strong>${personDelta} points</strong>!</p>`;
		mainMessage += `<p style="color: #bb0000; font-weight: bold;">Collect your coffee!</p>`;
	} else {
		mainMessage = `<p>You were off by <strong>${personDelta} points</strong> and finished in <strong>${personRank}${getRankSuffix(personRank)} place</strong>.</p>`;

		if (isBetting && winner.user.id !== coffeeWinner.user.id) {
			mainMessage += `<p style="color: #666;">You owe coffee to <strong>${coffeeWinner.user.name}</strong> who was off by ${coffeeWinner.prediction.delta}.</p>`;
		} else if (isBetting) {
			mainMessage += `<p style="color: #666;">You owe coffee to <strong>${winner.user.name}</strong> who was off by ${winner.prediction.delta}.</p>`;
		} else {
			mainMessage += `<p><strong>${winner.user.name}</strong> won by being off by ${winner.prediction.delta} points.</p>`;
		}
	}

	// Build leaderboard
	let leaderboard = '<h2 style="color: #bb0000;">Final Results</h2>';
	leaderboard += '<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">';
	leaderboard += '<tr style="background-color: #f5f5f5; border-bottom: 2px solid #bb0000;">';
	leaderboard += '<th style="padding: 10px; text-align: left;">Rank</th>';
	leaderboard += '<th style="padding: 10px; text-align: left;">Name</th>';
	leaderboard += '<th style="padding: 10px; text-align: center;">Prediction</th>';
	leaderboard += '<th style="padding: 10px; text-align: center;">Points Off</th>';
	leaderboard += '</tr>';

	allPredictions.forEach((pred, idx) => {
		const isCurrentUser = pred.user.id === person.user.id;
		const rowStyle = isCurrentUser ? 'background-color: #fff3cd; font-weight: bold;' : '';
		leaderboard += `<tr style="${rowStyle} border-bottom: 1px solid #ddd;">`;
		leaderboard += `<td style="padding: 10px;">${idx + 1}</td>`;
		leaderboard += `<td style="padding: 10px;">${pred.user.name}${pred.prediction.wonCoffee ? ' ☕' : ''}</td>`;
		leaderboard += `<td style="padding: 10px; text-align: center;">${pred.prediction.homeScore} - ${pred.prediction.awayScore}</td>`;
		leaderboard += `<td style="padding: 10px; text-align: center;">${pred.prediction.delta}</td>`;
		leaderboard += '</tr>';
	});

	leaderboard += '</table>';

	return `
		${congratsMessage}
		<h2>Game Final: ${game.homeTeam} ${game.homeScore} - ${game.awayScore} ${game.awayTeam}</h2>
		${mainMessage}
		${leaderboard}
	`;
}

function getRankSuffix(rank: number): string {
	if (rank === 1) return 'st';
	if (rank === 2) return 'nd';
	if (rank === 3) return 'rd';
	return 'th';
}

/**
 * Send game result notifications to all members
 */
export async function sendGameResultNotifications(
	gameId: number,
	groupId: number,
	adminEmail?: string,
	adminPhone?: string
): Promise<{
	emailsSent: number;
	smsSent: number;
	errors: string[];
}> {
	const errors: string[] = [];

	try {
		// Update prediction stats first
		await updatePredictionStats(gameId, groupId);

		// Get game results data
		const data = await getGameResultsData(gameId, groupId);

		// Prepare messages for each person
		const emailMessages: Array<{ email: string; subject: string; html: string; text: string }> = [];
		const smsMessages: Array<{ phone: string; message: string }> = [];

		for (const person of data.allPredictions) {
			// Email
			if (person.user.emailNotifications) {
				const emailHTML = generateEmailHTML(person, data);
				const { html, text } = createEmailTemplate({
					title: `Game Results: ${data.game.homeTeam} vs ${data.game.awayTeam}`,
					body: emailHTML,
					footerText: `${data.group.name} | Buckeye Predictions`
				});

				emailMessages.push({
					email: person.user.email,
					subject: `Game Results: ${data.game.homeTeam} vs ${data.game.awayTeam}`,
					html,
					text
				});
			}

			// SMS
			if (person.user.smsNotifications && person.user.phoneNumber) {
				const smsMessage = generateSMSMessage(person, data);
				smsMessages.push({
					phone: person.user.phoneNumber,
					message: smsMessage
				});
			}
		}

		// Send emails
		let emailsSent = 0;
		if (emailMessages.length > 0) {
			for (const msg of emailMessages) {
				const result = await sendBulkEmail({
					recipients: [msg.email],
					subject: msg.subject,
					html: msg.html,
					text: msg.text,
					adminEmail
				});

				if (result.sent > 0) emailsSent++;
				if (result.errors.length > 0) {
					errors.push(...result.errors.map(e => `Email to ${e.email}: ${e.error}`));
				}
			}
		}

		// Send SMS (personalized messages with centralized dev mode filtering)
		let smsSent = 0;
		if (smsMessages.length > 0) {
			const result = await sendPersonalizedSMS({
				messages: smsMessages,
				adminPhone
			});

			smsSent = result.sent;
			if (result.errors.length > 0) {
				errors.push(...result.errors.map(e => `SMS to ${e.phone}: ${e.error}`));
			}
		}

		return {
			emailsSent,
			smsSent,
			errors
		};
	} catch (error) {
		console.error('Error sending game result notifications:', error);
		throw error;
	}
}
