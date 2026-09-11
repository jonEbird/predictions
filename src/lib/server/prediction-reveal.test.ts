import { describe, it, expect, vi, beforeEach } from 'vitest';

// Queued rows, consumed in the order the sender issues its queries: game, then
// group, then the picks. Each awaited query chain shifts one entry off.
let queuedRows: unknown[][] = [];

/**
 * Stands in for a drizzle query builder: every method returns the chain again,
 * and awaiting it yields the next queued result. Keeps the tests focused on
 * which email goes out rather than on the shape of the joins.
 */
function queryChain(): unknown {
	const chain: unknown = new Proxy(
		{},
		{
			get(_target, prop) {
				if (prop === 'then') {
					const rows = queuedRows.shift() ?? [];
					return (resolve: (value: unknown) => void) => resolve(rows);
				}
				return () => chain;
			}
		}
	);
	return chain;
}

vi.mock('$lib/db', () => ({
	db: { select: () => queryChain() }
}));

vi.mock('./email', async () => {
	const actual = await vi.importActual<typeof import('./email')>('./email');
	return {
		...actual,
		sendBulkEmail: vi.fn()
	};
});

vi.mock('./queries/predictions', () => ({
	haveAllMembersPredicted: vi.fn()
}));

const GAME_ID = 7;
const GROUP_ID = 3;

const GAME = { id: GAME_ID, homeTeam: 'Ohio State', awayTeam: 'Michigan' };
const GROUP = { id: GROUP_ID, name: 'Bucknuts' };

function pick(id: number, name: string, homeScore: number, awayScore: number, emailNotifications = true) {
	return {
		prediction: { id, homeScore, awayScore },
		user: { id, name, email: `${name.toLowerCase()}@example.com`, emailNotifications }
	};
}

function queueGameWithPicks(picks: unknown[]) {
	queuedRows = [[GAME], [GROUP], picks];
}

describe('notifyIfPredictionsJustCompleted', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		queuedRows = [];
	});

	it('emails the group when the last pick completes it', async () => {
		const { haveAllMembersPredicted } = await import('./queries/predictions');
		const { sendBulkEmail } = await import('./email');
		const { notifyIfPredictionsJustCompleted } = await import('./prediction-reveal');

		vi.mocked(haveAllMembersPredicted).mockResolvedValue(true);
		vi.mocked(sendBulkEmail).mockResolvedValue({
			sent: 2,
			failed: 0,
			skipped: 0,
			errors: [],
			devMode: false
		});
		queueGameWithPicks([pick(1, 'Jon', 31, 17), pick(2, 'Pat', 24, 21)]);

		await notifyIfPredictionsJustCompleted(GAME_ID, GROUP_ID, false);

		expect(sendBulkEmail).toHaveBeenCalledTimes(1);
		const sent = vi.mocked(sendBulkEmail).mock.calls[0][0];
		expect(sent.subject).toBe('Predictions on the Ohio State vs. Michigan Game');
		expect(sent.recipients).toEqual(['jon@example.com', 'pat@example.com']);
		expect(sent.text).toContain('Predictions are in!');
		expect(sent.text).toContain('31 - 17 by Jon (Ohio State by 14)');
		expect(sent.text).toContain('24 - 21 by Pat (Ohio State by 3)');
		expect(sent.html).toContain('Ohio State – Michigan');
		expect(sent.html).toContain('Margin');
	});

	it('lists the picks in the order they were submitted', async () => {
		const { haveAllMembersPredicted } = await import('./queries/predictions');
		const { sendBulkEmail } = await import('./email');
		const { notifyIfPredictionsJustCompleted } = await import('./prediction-reveal');

		vi.mocked(haveAllMembersPredicted).mockResolvedValue(true);
		vi.mocked(sendBulkEmail).mockResolvedValue({
			sent: 3,
			failed: 0,
			skipped: 0,
			errors: [],
			devMode: false
		});
		// Deliberately not in margin order -- the query hands them back oldest first.
		queueGameWithPicks([pick(1, 'Jon', 17, 17), pick(2, 'Pat', 35, 3), pick(3, 'Casey', 7, 21)]);

		await notifyIfPredictionsJustCompleted(GAME_ID, GROUP_ID, false);

		const { text } = vi.mocked(sendBulkEmail).mock.calls[0][0];
		expect(text!.indexOf('by Jon')).toBeLessThan(text!.indexOf('by Pat'));
		expect(text!.indexOf('by Pat')).toBeLessThan(text!.indexOf('by Casey'));
		// An even score has no winner to name.
		expect(text).toContain('17 - 17 by Jon (Tie)');
		expect(text).toContain('7  - 21 by Casey (Michigan by 14)');
	});

	it('stays silent when an admin corrects a pick after the reveal', async () => {
		const { haveAllMembersPredicted } = await import('./queries/predictions');
		const { sendBulkEmail } = await import('./email');
		const { notifyIfPredictionsJustCompleted } = await import('./prediction-reveal');

		await notifyIfPredictionsJustCompleted(GAME_ID, GROUP_ID, true);

		expect(sendBulkEmail).not.toHaveBeenCalled();
		// The group was already whole, so completeness never needs re-checking.
		expect(haveAllMembersPredicted).not.toHaveBeenCalled();
	});

	it('stays silent while picks are still outstanding', async () => {
		const { haveAllMembersPredicted } = await import('./queries/predictions');
		const { sendBulkEmail } = await import('./email');
		const { notifyIfPredictionsJustCompleted } = await import('./prediction-reveal');

		vi.mocked(haveAllMembersPredicted).mockResolvedValue(false);

		await notifyIfPredictionsJustCompleted(GAME_ID, GROUP_ID, false);

		expect(sendBulkEmail).not.toHaveBeenCalled();
	});

	it('skips members who turned email notifications off', async () => {
		const { haveAllMembersPredicted } = await import('./queries/predictions');
		const { sendBulkEmail } = await import('./email');
		const { notifyIfPredictionsJustCompleted } = await import('./prediction-reveal');

		vi.mocked(haveAllMembersPredicted).mockResolvedValue(true);
		vi.mocked(sendBulkEmail).mockResolvedValue({
			sent: 1,
			failed: 0,
			skipped: 0,
			errors: [],
			devMode: false
		});
		queueGameWithPicks([pick(1, 'Jon', 31, 17), pick(2, 'Pat', 24, 21, false)]);

		await notifyIfPredictionsJustCompleted(GAME_ID, GROUP_ID, false);

		expect(vi.mocked(sendBulkEmail).mock.calls[0][0].recipients).toEqual(['jon@example.com']);
	});

	it('swallows send failures so the prediction still saves', async () => {
		const { haveAllMembersPredicted } = await import('./queries/predictions');
		const { sendBulkEmail } = await import('./email');
		const { notifyIfPredictionsJustCompleted } = await import('./prediction-reveal');

		vi.mocked(haveAllMembersPredicted).mockResolvedValue(true);
		vi.mocked(sendBulkEmail).mockRejectedValue(new Error('Resend is down'));
		queueGameWithPicks([pick(1, 'Jon', 31, 17)]);

		await expect(
			notifyIfPredictionsJustCompleted(GAME_ID, GROUP_ID, false)
		).resolves.toBeUndefined();
	});
});
