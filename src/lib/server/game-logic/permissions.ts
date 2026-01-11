import type { User, Group, Game, Prediction } from '$lib/db/schema';
import { isUserGroupAdmin, isUserMemberOfGroup } from '../queries/groups';
import { hasGameStarted } from '../queries/games';

/**
 * Check if a user can make or edit a prediction for a game
 * Rules:
 * 1. User must be a member of the group
 * 2. Game must not have started yet
 */
export async function canUserPredict(
	user: User,
	game: Game,
	groupId: number
): Promise<boolean> {
	// Check if game has started
	const gameStarted = await hasGameStarted(game.id);
	if (gameStarted) {
		return false;
	}

	// Check if user is a member of the group
	return await isUserMemberOfGroup(user.id, groupId);
}

/**
 * Check if a user can edit an existing prediction
 * Rules:
 * 1. Must be their own prediction
 * 2. Game must not have started yet
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

	// Game must not have started
	return !(await hasGameStarted(game.id));
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
 * 2. Predictions are hidden until game starts
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

	// Game must have started for predictions to be visible
	return await hasGameStarted(game.id);
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
