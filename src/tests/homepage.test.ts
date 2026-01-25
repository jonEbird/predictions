import { describe, it, expect, vi } from 'vitest';

// Mock the dependencies before importing the module
vi.mock('$lib/server/queries/groups', () => ({
	getGroupSeasons: vi.fn()
}));

vi.mock('$lib/config', () => ({
	DEFAULT_GROUP_SLUG: 'bucknuts'
}));

describe('Homepage route', () => {
	it('should redirect authenticated user to default group', async () => {
		// Dynamically import after mocks are set up
		const { getGroupSeasons } = await import('$lib/server/queries/groups');
		const { load } = await import('../routes/+page.server');

		// Mock getGroupSeasons to return seasons
		vi.mocked(getGroupSeasons).mockResolvedValue([
			{ season: 2024, gameCount: 10 },
			{ season: 2023, gameCount: 12 }
		] as any);

		const mockLocals = {
			user: {
				id: 1,
				name: 'Test User',
				email: 'test@example.com',
				nickname: null
			}
		};

		try {
			await load({ locals: mockLocals } as any);
			// Should not reach here - should throw redirect
			expect(true).toBe(false);
		} catch (error: any) {
			// SvelteKit redirect throws an error with status and location
			expect(error.status).toBe(303);
			expect(error.location).toBe('/groups/bucknuts?season=2024');
		}
	});

	it('should redirect to current year if no seasons exist', async () => {
		const { getGroupSeasons } = await import('$lib/server/queries/groups');
		const { load } = await import('../routes/+page.server');

		// Mock getGroupSeasons to return empty array
		vi.mocked(getGroupSeasons).mockResolvedValue([]);

		const currentYear = new Date().getFullYear();

		const mockLocals = {
			user: {
				id: 1,
				name: 'Test User',
				email: 'test@example.com',
				nickname: null
			}
		};

		try {
			await load({ locals: mockLocals } as any);
			expect(true).toBe(false);
		} catch (error: any) {
			expect(error.status).toBe(303);
			expect(error.location).toBe(`/groups/bucknuts?season=${currentYear}`);
		}
	});

	it('should redirect unauthenticated user to default group', async () => {
		const { getGroupSeasons } = await import('$lib/server/queries/groups');
		const { load } = await import('../routes/+page.server');

		// Mock getGroupSeasons to return seasons
		vi.mocked(getGroupSeasons).mockResolvedValue([
			{ season: 2026, gameCount: 10 }
		] as any);

		const mockLocals = {
			user: null
		};

		try {
			await load({ locals: mockLocals } as any);
			// Should not reach here - should throw redirect
			expect(true).toBe(false);
		} catch (error: any) {
			// SvelteKit redirect throws an error with status and location
			expect(error.status).toBe(303);
			expect(error.location).toBe('/groups/bucknuts?season=2026');
		}
	});
});
