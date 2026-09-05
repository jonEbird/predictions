import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../queries/games', () => ({
	hasGameStarted: vi.fn()
}));

vi.mock('../queries/groups', () => ({
	isUserGroupAdmin: vi.fn(),
	isUserMemberOfGroup: vi.fn()
}));

vi.mock('../queries/predictions', () => ({
	haveAllMembersPredicted: vi.fn()
}));

const GAME = { id: 7 } as any;
const USER = { id: 1 } as any;
const GROUP_ID = 3;

describe('prediction locking', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('locks once every member has predicted, even before kickoff', async () => {
		const { hasGameStarted } = await import('../queries/games');
		const { haveAllMembersPredicted } = await import('../queries/predictions');
		const { arePredictionsLocked } = await import('./permissions');

		vi.mocked(hasGameStarted).mockResolvedValue(false);
		vi.mocked(haveAllMembersPredicted).mockResolvedValue(true);

		expect(await arePredictionsLocked(GAME.id, GROUP_ID)).toBe(true);
	});

	it('locks at kickoff even if somebody never predicted', async () => {
		const { hasGameStarted } = await import('../queries/games');
		const { haveAllMembersPredicted } = await import('../queries/predictions');
		const { arePredictionsLocked } = await import('./permissions');

		vi.mocked(hasGameStarted).mockResolvedValue(true);
		vi.mocked(haveAllMembersPredicted).mockResolvedValue(false);

		expect(await arePredictionsLocked(GAME.id, GROUP_ID)).toBe(true);
	});

	it('stays open while picks are still outstanding and the game has not started', async () => {
		const { hasGameStarted } = await import('../queries/games');
		const { haveAllMembersPredicted } = await import('../queries/predictions');
		const { arePredictionsLocked } = await import('./permissions');

		vi.mocked(hasGameStarted).mockResolvedValue(false);
		vi.mocked(haveAllMembersPredicted).mockResolvedValue(false);

		expect(await arePredictionsLocked(GAME.id, GROUP_ID)).toBe(false);
	});
});

describe('canUserPredict', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('lets a member predict while picks are open', async () => {
		const { hasGameStarted } = await import('../queries/games');
		const { haveAllMembersPredicted } = await import('../queries/predictions');
		const { isUserMemberOfGroup } = await import('../queries/groups');
		const { canUserPredict } = await import('./permissions');

		vi.mocked(hasGameStarted).mockResolvedValue(false);
		vi.mocked(haveAllMembersPredicted).mockResolvedValue(false);
		vi.mocked(isUserMemberOfGroup).mockResolvedValue(true);

		expect(await canUserPredict(USER, GAME, GROUP_ID)).toBe(true);
	});

	it('refuses a member once the whole group is in', async () => {
		const { hasGameStarted } = await import('../queries/games');
		const { haveAllMembersPredicted } = await import('../queries/predictions');
		const { isUserMemberOfGroup } = await import('../queries/groups');
		const { canUserPredict } = await import('./permissions');

		vi.mocked(hasGameStarted).mockResolvedValue(false);
		vi.mocked(haveAllMembersPredicted).mockResolvedValue(true);
		vi.mocked(isUserMemberOfGroup).mockResolvedValue(true);

		expect(await canUserPredict(USER, GAME, GROUP_ID)).toBe(false);
	});

	it('refuses a non-member even while picks are open', async () => {
		const { hasGameStarted } = await import('../queries/games');
		const { haveAllMembersPredicted } = await import('../queries/predictions');
		const { isUserMemberOfGroup } = await import('../queries/groups');
		const { canUserPredict } = await import('./permissions');

		vi.mocked(hasGameStarted).mockResolvedValue(false);
		vi.mocked(haveAllMembersPredicted).mockResolvedValue(false);
		vi.mocked(isUserMemberOfGroup).mockResolvedValue(false);

		expect(await canUserPredict(USER, GAME, GROUP_ID)).toBe(false);
	});
});

describe('canViewPredictions', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('reveals picks to a member as soon as they lock', async () => {
		const { hasGameStarted } = await import('../queries/games');
		const { haveAllMembersPredicted } = await import('../queries/predictions');
		const { isUserMemberOfGroup } = await import('../queries/groups');
		const { canViewPredictions } = await import('./permissions');

		vi.mocked(hasGameStarted).mockResolvedValue(false);
		vi.mocked(haveAllMembersPredicted).mockResolvedValue(true);
		vi.mocked(isUserMemberOfGroup).mockResolvedValue(true);

		expect(await canViewPredictions(USER, GAME, GROUP_ID)).toBe(true);
	});

	it('hides picks while they are still being collected', async () => {
		const { hasGameStarted } = await import('../queries/games');
		const { haveAllMembersPredicted } = await import('../queries/predictions');
		const { isUserMemberOfGroup } = await import('../queries/groups');
		const { canViewPredictions } = await import('./permissions');

		vi.mocked(hasGameStarted).mockResolvedValue(false);
		vi.mocked(haveAllMembersPredicted).mockResolvedValue(false);
		vi.mocked(isUserMemberOfGroup).mockResolvedValue(true);

		expect(await canViewPredictions(USER, GAME, GROUP_ID)).toBe(false);
	});
});
