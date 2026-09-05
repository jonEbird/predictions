import type { User, Group, Game, Prediction } from '$lib/db/schema';
import { isUserGroupAdmin, isUserMemberOfGroup } from '../queries/groups';
import { hasGameStarted } from '../queries/games';
import { haveAllMembersPredicted } from '../queries/predictions';

/**
 * Check whether predictions for a game are locked for a group
 *
 * Predictions lock as soon as the whole group has weighed in — that's the point
 * at which everyone's picks are revealed for discussion, so nobody gets to
 * revise theirs after seeing the others. They also lock at kickoff, which
 * covers the case where somebody never got around to predicting.
 *
 * Admins are exempt: they edit through the admin-only actions, which are how
 * a transposed home/away score gets fixed after the reveal.
 */
export async function arePredictionsLocked(gameId: number, groupId: number): Promise<boolean> {
	if (await hasGameStarted(gameId)) {
		return true;
	}

	return await haveAllMembersPredicted(gameId, groupId);
}

/**
 * Check if a user can make or edit a prediction for a game
 * Rules:
 * 1. User must be a member of the group
 * 2. Predictions must not be locked yet
 */
export async function canUserPredict(
	user: User,
	game: Game,
	groupId: number
): Promise<boolean> {
	// Check if predictions are still open
	if (await arePredictionsLocked(game.id, groupId)) {
		return false;
	}

	// Check if user is a member of the group
	return await isUserMemberOfGroup(user.id, groupId);
}

/**
 * Check if a user can edit an existing prediction
 * Rules:
 * 1. Must be their own prediction
 * 2. Predictions must not be locked yet
 */
export async function canEditPrediction(
	user: User,
	prediction: Prediction,
	game: Game
): Promise<boolean> {
	// Must be their own prediction
	if (prediction.userId !== user.id) {
		return false;
	}

	return !(await arePredictionsLocked(game.id, prediction.groupId));
}

/**
 * Check if a user is an admin of a group
 */
export async function isUserAdmin(user: User, group: Group): Promise<boolean> {
	return await isUserGroupAdmin(user.id, group.id);
}

/**
 * Check if a user can view predictions for a game
 * Rules:
 * 1. User must be a member of the group
 * 2. Predictions are hidden until they lock
 */
export async function canViewPredictions(
	user: User,
	game: Game,
	groupId: number
): Promise<boolean> {
	// Must be a member
	const isMember = await isUserMemberOfGroup(user.id, groupId);
	if (!isMember) {
		return false;
	}

	// Predictions stay hidden until they're locked
	return await arePredictionsLocked(game.id, groupId);
}

/**
 * Check if a user can post a final score
 * Rules:
 * 1. User must be an admin of the group
 * 2. Game must have started
 */
export async function canPostFinalScore(
	user: User,
	game: Game,
	groupId: number
): Promise<boolean> {
	// Must be admin
	const isAdmin = await isUserGroupAdmin(user.id, groupId);
	if (!isAdmin) {
		return false;
	}

	// Game must have started
	return await hasGameStarted(game.id);
}

/**
 * Check if a user can create a game
 * Rules:
 * 1. User must be an admin of at least one group
 */
export async function canCreateGame(user: User, groupId: number): Promise<boolean> {
	return await isUserGroupAdmin(user.id, groupId);
}

/**
 * Check if a user can send messages to a group
 * Rules:
 * 1. User must be an admin of the group
 */
export async function canSendGroupMessages(user: User, groupId: number): Promise<boolean> {
	return await isUserGroupAdmin(user.id, groupId);
}

/**
 * Check if a user can manage group members
 * Rules:
 * 1. User must be the owner of the group
 */
export async function canManageGroupMembers(user: User, group: Group): Promise<boolean> {
	return user.id === group.ownerId;
}
