import { db } from '$lib/db';
import { games, predictions, users, memberships, groups, contactUserColumns } from '$lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { sendBulkEmail, createEmailTemplate } from './email';
import { haveAllMembersPredicted } from './queries/predictions';
import { SITE_URL } from '$lib/config';
import { marginLabel, findExtremes, extremeEmoji, EXTREME_LABELS } from '$lib/scores';

/**
 * Build the "predictions are in" email for a game and send it to the group.
 *
 * Carried over from the Python version's email_predictions(): the moment the
 * last member weighs in, the picks are locked and revealed, so everyone gets to
 * size up the field before kickoff instead of having to visit the site.
 */
export async function sendPredictionsRevealedEmail(
	gameId: number,
	groupId: number,
	devRecipient?: string
): Promise<{ sent: number; failed: number }> {
	const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);

	if (!game[0]) {
		throw new Error('Game not found');
	}

	const group = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);

	if (!group[0]) {
		throw new Error('Group not found');
	}

	// Joined against memberships so a pick left behind by someone who has since
	// left the group doesn't appear alongside the current roster's.
	const picks = await db
		.select({
			prediction: predictions,
			user: contactUserColumns
		})
		.from(predictions)
		.innerJoin(users, eq(predictions.userId, users.id))
		.innerJoin(
			memberships,
			and(
				eq(predictions.userId, memberships.userId),
				eq(predictions.groupId, memberships.groupId)
			)
		)
		.where(and(eq(predictions.gameId, gameId), eq(predictions.groupId, groupId)))
		// No ranking to sort by yet -- the game hasn't been played -- so the picks
		// read in the order they came in, same as the Python version.
		.orderBy(asc(predictions.createdAt));

	if (picks.length === 0) {
		throw new Error('No predictions found for this game');
	}

	const { homeTeam, awayTeam } = game[0];
	const gameUrl = `${SITE_URL}/games/${gameId}?groupId=${groupId}`;
	const subject = `Predictions on the ${homeTeam} vs. ${awayTeam} Game`;

	const extremes = findExtremes(
		picks.map(({ prediction }) => prediction),
		game[0],
		group[0].homeTeam
	);

	let table = '<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">';
	table += '<tr style="background-color: #f5f5f5; border-bottom: 2px solid #bb0000;">';
	table += '<th style="padding: 10px; text-align: left;">Player</th>';
	table += `<th style="padding: 10px; text-align: center;">${homeTeam} – ${awayTeam}</th>`;
	table += '<th style="padding: 10px; text-align: right;">Margin</th>';
	table += '</tr>';

	// Collected as the rows are built so the legend explains the exact faces the
	// table used, rather than picking its own.
	const facesUsed: Array<{ emoji: string; label: string }> = [];

	for (const { prediction, user } of picks) {
		const extreme = extremes.get(prediction.id);
		const margin = marginLabel(prediction.homeScore, prediction.awayScore, game[0]);
		let face = '';

		if (extreme) {
			const emoji = extremeEmoji(extreme, prediction.id);
			face = `${emoji} `;
			facesUsed.push({ emoji, label: EXTREME_LABELS[extreme].label });
		}

		table += '<tr style="border-bottom: 1px solid #ddd;">';
		table += `<td style="padding: 10px;">${user.name}</td>`;
		table += `<td style="padding: 10px; text-align: center;">${prediction.homeScore} - ${prediction.awayScore}</td>`;
		table += `<td style="padding: 10px; text-align: right; color: #666;">${face}${margin}</td>`;
		table += '</tr>';
	}

	table += '</table>';

	// Only worth explaining when a flag actually went out -- most weeks nobody is
	// far enough clear of the pack to earn one.
	const legend = facesUsed.length
		? `<p style="font-size: 0.9em; color: #666;">${facesUsed
				.map((f) => `${f.emoji} ${f.label}`)
				.join(' &nbsp;·&nbsp; ')}</p>`
		: '';

	const body = `
		<p>Predictions are in!</p>
		${table}
		${legend}
		<p><a href="${gameUrl}">See them on the site</a></p>
		<p>Good luck, folks.</p>
	`;

	const text = [
		'Predictions are in!',
		'',
		`${homeTeam} - ${awayTeam}`,
		...picks.map(({ prediction, user }) => {
			const extreme = extremes.get(prediction.id);
			const margin = marginLabel(prediction.homeScore, prediction.awayScore, game[0]);
			// The word rather than the emoji: a glyph on its own tells a plain-text
			// reader nothing.
			const note = extreme ? `, ${EXTREME_LABELS[extreme].label.toLowerCase()}` : '';

			return `${String(prediction.homeScore).padEnd(2)} - ${String(prediction.awayScore).padEnd(2)} by ${user.name} (${margin}${note})`;
		}),
		'',
		`See them on the site: ${gameUrl}`,
		'',
		'Good luck, folks.'
	].join('\n');

	const { html, text: renderedText } = createEmailTemplate({
		title: `${homeTeam} vs. ${awayTeam}`,
		body,
		text,
		footerText: `${group[0].name} | Buckeye Predictions`
	});

	const recipients = picks.filter((p) => p.user.emailNotifications).map((p) => p.user.email);

	if (recipients.length === 0) {
		return { sent: 0, failed: 0 };
	}

	const result = await sendBulkEmail({
		recipients,
		subject,
		html,
		text: renderedText,
		// Dev mode narrows delivery to this one address. Passing whoever submitted
		// the completing prediction means the feature is testable locally; in
		// production sendBulkEmail ignores it and mails the whole group.
		adminEmail: devRecipient
	});

	if (result.errors.length > 0) {
		console.error(
			'Errors sending predictions-revealed email:',
			result.errors.map((e) => `${e.email}: ${e.error}`).join(', ')
		);
	}

	return { sent: result.sent, failed: result.failed };
}

/**
 * Send the reveal email if the write that just landed is the one that completed
 * the group.
 *
 * `wasComplete` must be read *before* the write, so the caller can tell a
 * genuine completion from a change made to an already-complete game. Admin
 * corrections after the reveal deliberately stay silent -- the group has
 * already seen the picks, and a second copy of the same email is noise.
 *
 * Never throws: a notification failure must not fail the prediction that
 * triggered it.
 */
export async function notifyIfPredictionsJustCompleted(
	gameId: number,
	groupId: number,
	wasComplete: boolean,
	devRecipient?: string
): Promise<void> {
	if (wasComplete) {
		return;
	}

	try {
		if (!(await haveAllMembersPredicted(gameId, groupId))) {
			return;
		}

		const { sent } = await sendPredictionsRevealedEmail(gameId, groupId, devRecipient);
		console.log(`📧 Predictions revealed for game ${gameId}: emailed ${sent} member(s)`);
	} catch (error) {
		console.error('Error sending predictions-revealed email:', error);
	}
}
