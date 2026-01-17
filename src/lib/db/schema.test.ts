import { describe, it, expect } from 'vitest';
import { users, groups, memberships, games, predictions, cronJobs } from './schema';
import type { User, NewUser, Group, NewGroup, Game, NewGame } from './schema';

describe('Database Schema', () => {
	describe('Type exports', () => {
		it('should export User types', () => {
			// Test that types are defined (TypeScript compilation check)
			const user: Partial<User> = {
				id: 1,
				name: 'Test User',
				email: 'test@example.com'
			};

			expect(user.id).toBe(1);
			expect(user.name).toBe('Test User');
		});

		it('should export Group types', () => {
			const group: Partial<Group> = {
				id: 1,
				name: 'Test Group',
				slug: 'test-group',
				season: 2024
			};

			expect(group.season).toBe(2024);
		});

		it('should export NewUser type for insertions', () => {
			const newUser: Partial<NewUser> = {
				name: 'New User',
				email: 'new@example.com',
				passwordHash: 'hashed_password'
			};

			expect(newUser.name).toBe('New User');
		});
	});

	describe('Schema structure', () => {
		it('should have users table with required fields', () => {
			expect(users).toBeDefined();
			expect(users.id).toBeDefined();
			expect(users.name).toBeDefined();
			expect(users.email).toBeDefined();
			expect(users.passwordHash).toBeDefined();
		});

		it('should have groups table with required fields', () => {
			expect(groups).toBeDefined();
			expect(groups.id).toBeDefined();
			expect(groups.name).toBeDefined();
			expect(groups.slug).toBeDefined();
			expect(groups.season).toBeDefined();
		});

		it('should have games table with required fields', () => {
			expect(games).toBeDefined();
			expect(games.id).toBeDefined();
			expect(games.homeTeam).toBeDefined();
			expect(games.awayTeam).toBeDefined();
			expect(games.gameTime).toBeDefined();
		});

		it('should have predictions table with required fields', () => {
			expect(predictions).toBeDefined();
			expect(predictions.id).toBeDefined();
			expect(predictions.userId).toBeDefined();
			expect(predictions.gameId).toBeDefined();
			expect(predictions.homeScore).toBeDefined();
			expect(predictions.awayScore).toBeDefined();
		});

		it('should have memberships table with required fields', () => {
			expect(memberships).toBeDefined();
			expect(memberships.id).toBeDefined();
			expect(memberships.userId).toBeDefined();
			expect(memberships.groupId).toBeDefined();
		});

		it('should have cronJobs table with required fields', () => {
			expect(cronJobs).toBeDefined();
			expect(cronJobs.id).toBeDefined();
			expect(cronJobs.name).toBeDefined();
			expect(cronJobs.jobType).toBeDefined();
			expect(cronJobs.schedule).toBeDefined();
		});
	});
});
