import { redirect, error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getGameById, getGameWithPredictions, hasGameStarted } from '$lib/server/queries/games';
import { getUserPrediction, createPrediction, updatePrediction } from '$lib/server/queries/predictions';
import { isUserMemberOfGroup, getGroupMembers, isUserGroupAdmin } from '$lib/server/queries/groups';
import { canUserPredict } from '$lib/server/game-logic/permissions';
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
	const isAdmin = locals.user ? await isUserGroupAdmin(locals.user.id, groupId) : false;

	// Get game with all predictions
	const gameData = await getGameWithPredictions(gameId, groupId);

	if (!gameData) {
		throw error(404, 'Game not found');
	}

	// Get user's prediction if user is authenticated
	const userPrediction = locals.user ? await getUserPrediction(locals.user.id, gameId, groupId) : null;

	// Check if game has started
	const gameStarted = await hasGameStarted(gameId);

	// Check if user can predict (only for authenticated users)
	const canPredict = locals.user ? await canUserPredict(locals.user, gameData.game, groupId) : false;

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
	let predictionsWithDeltas = gameStarted || isAdmin ? gameData.predictions : [];

	if ((gameStarted || isAdmin) && gameData.game.homeScore !== null && gameData.game.awayScore !== null) {
		// Calculate delta for each prediction
		predictionsWithDeltas = gameData.predictions.map(({ prediction, user }) => {
			const homeDiff = Math.abs(prediction.homeScore - gameData.game.homeScore!);
			const awayDiff = Math.abs(prediction.awayScore - gameData.game.awayScore!);
			const calculatedDelta = homeDiff + awayDiff;

			return {
				prediction: {
					...prediction,
					delta: calculatedDelta
				},
				user
			};
		});

		// Sort by delta (lowest = best)
		predictionsWithDeltas.sort((a, b) => a.prediction.delta! - b.prediction.delta!);
	}

	return {
		game: gameData.game,
		predictions: predictionsWithDeltas,
		userPrediction,
		canPredict,
		gameStarted,
		groupId,
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
				// Get all predictions for this game and group
				const gamePredictions = await db
					.select()
					.from(predictions)
					.where(and(eq(predictions.gameId, gameId), eq(predictions.groupId, groupId)));

				// Calculate delta for each prediction
				const predictionsWithDelta = gamePredictions.map((pred) => {
					const homeDiff = Math.abs(pred.homeScore - homeScore);
					const awayDiff = Math.abs(pred.awayScore - awayScore);
					const delta = homeDiff + awayDiff;

					return {
						...pred,
						delta
					};
				});

				// Sort by delta (lowest = best)
				predictionsWithDelta.sort((a, b) => a.delta - b.delta);

				// Assign ranks and determine winners
				const bestDelta = predictionsWithDelta[0]?.delta;

				for (let i = 0; i < predictionsWithDelta.length; i++) {
					const pred = predictionsWithDelta[i];
					const rank = i + 1;
					const wonCoffee = pred.delta === bestDelta;

					// Update prediction with delta, rank, and wonCoffee
					await db
						.update(predictions)
						.set({
							delta: pred.delta,
							rank,
							wonCoffee,
							updatedAt: new Date()
						})
						.where(eq(predictions.id, pred.id));
				}
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

			return { success: true, message: 'Prediction added successfully' };
		} catch (err) {
			console.error('Error adding prediction:', err);
			return fail(500, { message: 'Failed to add prediction' });
		}
	}
};
