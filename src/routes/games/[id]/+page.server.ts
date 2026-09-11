import { redirect, error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getGameById, getGameWithPredictions, hasGameStarted } from '$lib/server/queries/games';
import {
	getUserPrediction,
	createPrediction,
	updatePrediction,
	calculateRankings,
	haveAllMembersPredicted
} from '$lib/server/queries/predictions';
import { notifyIfPredictionsJustCompleted } from '$lib/server/prediction-reveal';
import {
	isUserMemberOfGroup,
	getGroupMembers,
	isUserGroupAdmin,
	getGroupById
} from '$lib/server/queries/groups';
import { canUserPredict, arePredictionsLocked } from '$lib/server/game-logic/permissions';
import { calculateDelta, sortPredictions, tiebreakNotes } from '$lib/server/game-logic/rankings';
import { db } from '$lib/db';
import { predictions, games } from '$lib/db/schema';
import { and, eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const gameId = parseInt(params.id, 10);
	const groupId = parseInt(url.searchParams.get('groupId') || '0', 10);

	if (!groupId) {
		throw error(400, 'Group ID is required');
	}

	// For authenticated users, check if they're a member of the group
	if (locals.user) {
		const isMember = await isUserMemberOfGroup(locals.user.id, groupId);
		if (!isMember) {
			throw error(403, 'You are not a member of this group');
		}
	}

	// Check if user is admin (only for authenticated users)
	// Display-only: respects the "view as member" toggle so an admin can preview
	// the member experience. The actions below re-check the real permission.
	const isAdmin =
		locals.user && !locals.viewAsMember
			? await isUserGroupAdmin(locals.user.id, groupId)
			: false;

	// Get game with all predictions
	const gameData = await getGameWithPredictions(gameId, groupId);

	if (!gameData) {
		throw error(404, 'Game not found');
	}

	// Get user's prediction if user is authenticated
	const userPrediction = locals.user ? await getUserPrediction(locals.user.id, gameId, groupId) : null;

	// Check if game has started
	const gameStarted = await hasGameStarted(gameId);

	// Predictions lock — and are revealed — once the whole group is in, or at kickoff
	const predictionsLocked = await arePredictionsLocked(gameId, groupId);

	// Check if user can predict (only for authenticated users)
	const canPredict = locals.user ? await canUserPredict(locals.user, gameData.game, groupId) : false;

	// The group's own team, so the page can tell an optimistic pick from a
	// pessimistic one regardless of which side of the matchup we're on.
	const group = await getGroupById(groupId);

	// Get all group members and their prediction status
	const allMembers = await getGroupMembers(groupId);

	const memberStatus = await Promise.all(
		allMembers.map(async (member) => {
			const hasPredicted = await db
				.select()
				.from(predictions)
				.where(
					and(
						eq(predictions.userId, member.user.id),
						eq(predictions.gameId, gameId),
						eq(predictions.groupId, groupId)
					)
				)
				.limit(1);

			return {
				user: member.user,
				hasPredicted: hasPredicted.length > 0
			};
		})
	);

	// Calculate deltas if game has scores entered
	let predictionsWithDeltas = predictionsLocked || isAdmin ? gameData.predictions : [];
	let tiebreaks: Record<number, string> = {};

	if (
		(predictionsLocked || isAdmin) &&
		gameData.game.homeScore !== null &&
		gameData.game.awayScore !== null
	) {
		const finalScore = {
			homeScore: gameData.game.homeScore,
			awayScore: gameData.game.awayScore
		};

		// Recalculated rather than read from the row: a live game has a score but
		// no stored delta yet, and an admin can still correct a final score. The
		// ordering is the same one the finisher writes to the rank column, so the
		// table can't disagree with the ranks it's displaying.
		const ordered = sortPredictions(
			gameData.predictions.map(({ prediction, user }) => ({
				...prediction,
				delta: calculateDelta(prediction, finalScore),
				name: user.name,
				user
			})),
			gameData.game
		);

		predictionsWithDeltas = ordered.map(({ user, name: _name, ...prediction }) => ({
			prediction,
			user
		}));

		tiebreaks = Object.fromEntries(tiebreakNotes(ordered, gameData.game));
	}

	return {
		game: gameData.game,
		predictions: predictionsWithDeltas,
		tiebreaks,
		userPrediction,
		canPredict,
		gameStarted,
		predictionsLocked,
		groupId,
		ourTeam: group?.homeTeam ?? null,
		memberStatus,
		isAdmin
	};
};

export const actions: Actions = {
	predict: async ({ request, locals, params, url }) => {
		if (!locals.user) {
			return fail(401, { message: 'Not authenticated' });
		}

		const gameId = parseInt(params.id, 10);
		const formData = await request.formData();
		const homeScore = parseInt(formData.get('homeScore') as string, 10);
		const awayScore = parseInt(formData.get('awayScore') as string, 10);
		const groupId = parseInt(formData.get('groupId') as string, 10);
		const predictionId = formData.get('predictionId') as string | null;

		// Validate inputs
		if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
			return fail(400, { message: 'Invalid scores' });
		}

		if (!groupId) {
			return fail(400, { message: 'Group ID is required' });
		}

		// Get game
		const game = await getGameById(gameId);
		if (!game) {
			return fail(404, { message: 'Game not found' });
		}

		// Check if user can predict
		const canPredict = await canUserPredict(locals.user, game, groupId);
		if (!canPredict) {
			return fail(403, { message: 'You cannot make predictions for this game' });
		}

		try {
			// Read before the write so the reveal email fires on the transition into
			// a complete group rather than on every pick that lands while it's whole.
			const wasComplete = await haveAllMembersPredicted(gameId, groupId);

			if (predictionId) {
				// Update existing prediction
				await updatePrediction(parseInt(predictionId, 10), homeScore, awayScore);
			} else {
				// Create new prediction
				await createPrediction({
					userId: locals.user.id,
					gameId,
					groupId,
					homeScore,
					awayScore,
					delta: null,
					rank: null,
					wonCoffee: false,
					createdAt: new Date(),
					updatedAt: new Date()
				});
			}

			await notifyIfPredictionsJustCompleted(gameId, groupId, wasComplete, locals.user.email);

			return { success: true };
		} catch (err) {
			console.error('Error saving prediction:', err);
			return fail(500, { message: 'Failed to save prediction' });
		}
	},

	updateFinalScore: async ({ request, locals, params, url }) => {
		if (!locals.user) {
			return fail(401, { message: 'Not authenticated' });
		}

		const gameId = parseInt(params.id, 10);
		const formData = await request.formData();
		const homeScore = parseInt(formData.get('homeScore') as string, 10);
		const awayScore = parseInt(formData.get('awayScore') as string, 10);
		const groupId = parseInt(formData.get('groupId') as string, 10);
		const status = formData.get('status') as string;

		// Validate inputs
		if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
			return fail(400, { message: 'Invalid scores' });
		}

		if (!groupId) {
			return fail(400, { message: 'Group ID is required' });
		}

		if (!status || !['live', 'finished', 'canceled'].includes(status)) {
			return fail(400, { message: 'Invalid status' });
		}

		// Check if user is admin
		const isAdmin = await isUserGroupAdmin(locals.user.id, groupId);
		if (!isAdmin) {
			return fail(403, { message: 'Only admins can update final scores' });
		}

		try {
			// Update game
			await db
				.update(games)
				.set({
					homeScore,
					awayScore,
					status,
					updatedAt: new Date()
				})
				.where(eq(games.id, gameId));

			// Calculate prediction results if status is 'finished'
			if (status === 'finished') {
				await calculateRankings(gameId, groupId);
			}

			return { success: true, message: 'Final score updated successfully' };
		} catch (err) {
			console.error('Error updating final score:', err);
			return fail(500, { message: 'Failed to update final score' });
		}
	},

	editPrediction: async ({ request, locals, params, url }) => {
		if (!locals.user) {
			return fail(401, { message: 'Not authenticated' });
		}

		const gameId = parseInt(params.id, 10);
		const formData = await request.formData();
		const predictionId = parseInt(formData.get('predictionId') as string, 10);
		const homeScore = parseInt(formData.get('homeScore') as string, 10);
		const awayScore = parseInt(formData.get('awayScore') as string, 10);
		const groupId = parseInt(formData.get('groupId') as string, 10);

		// Validate inputs
		if (isNaN(predictionId) || isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
			return fail(400, { message: 'Invalid input' });
		}

		if (!groupId) {
			return fail(400, { message: 'Group ID is required' });
		}

		// Check if user is admin
		const isAdmin = await isUserGroupAdmin(locals.user.id, groupId);
		if (!isAdmin) {
			return fail(403, { message: 'Only admins can edit predictions' });
		}

		try {
			// Deliberately silent: this only rewrites an existing row, so it can't
			// complete the group, and an admin correcting a pick after the group has
			// already seen the reveal email shouldn't trigger a second copy of it.
			// Update the prediction
			await db
				.update(predictions)
				.set({
					homeScore,
					awayScore,
					updatedAt: new Date()
				})
				.where(eq(predictions.id, predictionId));

			return { success: true, message: 'Prediction updated successfully' };
		} catch (err) {
			console.error('Error updating prediction:', err);
			return fail(500, { message: 'Failed to update prediction' });
		}
	},

	addPrediction: async ({ request, locals, params, url }) => {
		if (!locals.user) {
			return fail(401, { message: 'Not authenticated' });
		}

		const gameId = parseInt(params.id, 10);
		const formData = await request.formData();
		const userId = parseInt(formData.get('userId') as string, 10);
		const homeScore = parseInt(formData.get('homeScore') as string, 10);
		const awayScore = parseInt(formData.get('awayScore') as string, 10);
		const groupId = parseInt(formData.get('groupId') as string, 10);

		// Validate inputs
		if (isNaN(userId) || isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
			return fail(400, { message: 'Invalid input' });
		}

		if (!groupId) {
			return fail(400, { message: 'Group ID is required' });
		}

		// Check if user is admin
		const isAdmin = await isUserGroupAdmin(locals.user.id, groupId);
		if (!isAdmin) {
			return fail(403, { message: 'Only admins can add predictions for other users' });
		}

		try {
			// See the note in `predict`: an admin filling in the last holdout's pick
			// completes the group just as the member doing it themselves would, so
			// the reveal email fires either way.
			const wasComplete = await haveAllMembersPredicted(gameId, groupId);

			// Create the prediction
			await db.insert(predictions).values({
				userId,
				gameId,
				groupId,
				homeScore,
				awayScore,
				delta: null,
				rank: null,
				wonCoffee: false,
				createdAt: new Date(),
				updatedAt: new Date()
			});

			await notifyIfPredictionsJustCompleted(gameId, groupId, wasComplete, locals.user.email);

			return { success: true, message: 'Prediction added successfully' };
		} catch (err) {
			console.error('Error adding prediction:', err);
			return fail(500, { message: 'Failed to add prediction' });
		}
	}
};
