import { describe, it, expect } from 'vitest';
import {
	calculateDelta,
	pickedCorrectWinner,
	sortPredictions,
	determineCoffeeWinner,
	tiebreakNotes,
	compareStandings,
	rankStandings
} from './rankings';

const FINAL = { homeScore: 56, awayScore: 3 };

function pick(
	id: number,
	name: string,
	homeScore: number,
	awayScore: number,
	createdAt: string
) {
	return { id, name, homeScore, awayScore, createdAt: new Date(createdAt) };
}

describe('calculateDelta', () => {
	it('adds both sides of the miss', () => {
		expect(calculateDelta({ homeScore: 54, awayScore: 3 }, FINAL)).toBe(2);
		expect(calculateDelta({ homeScore: 63, awayScore: 0 }, FINAL)).toBe(10);
	});
});

describe('pickedCorrectWinner', () => {
	it('compares which side won, not the margin', () => {
		expect(pickedCorrectWinner({ homeScore: 1, awayScore: 0 }, FINAL)).toBe(true);
		expect(pickedCorrectWinner({ homeScore: 0, awayScore: 1 }, FINAL)).toBe(false);
		expect(pickedCorrectWinner({ homeScore: 7, awayScore: 7 }, FINAL)).toBe(false);
	});
});

describe('sortPredictions', () => {
	it('orders by delta first', () => {
		const ordered = sortPredictions(
			[
				pick(1, 'Mike', 56, 6, '2026-09-04T12:00:00Z'),
				pick(2, 'Mark', 54, 3, '2026-09-04T13:00:00Z')
			],
			FINAL
		);

		expect(ordered.map((p) => p.name)).toEqual(['Mark', 'Mike']);
	});

	it('gives an equal delta to whoever picked the winning side', () => {
		// Both 1 off a 21-20 final, but only one of them has the home team winning.
		const ordered = sortPredictions(
			[
				pick(1, 'Called a tie', 21, 21, '2026-09-01T12:00:00Z'),
				pick(2, 'Called the win', 22, 20, '2026-09-04T12:00:00Z')
			],
			{ homeScore: 21, awayScore: 20 }
		);

		expect(ordered[0].name).toBe('Called the win');
	});

	it('breaks a full tie on who locked in first', () => {
		const ordered = sortPredictions(
			[
				pick(2, 'Patrick', 54, 3, '2026-09-05T18:56:25Z'),
				pick(1, 'Mark', 54, 3, '2026-08-19T00:20:41Z')
			],
			FINAL
		);

		expect(ordered.map((p) => p.name)).toEqual(['Mark', 'Patrick']);
	});

	it('falls back to id when even the timestamps match', () => {
		const ordered = sortPredictions(
			[
				pick(9, 'Later row', 54, 3, '2026-09-05T18:56:25Z'),
				pick(4, 'Earlier row', 54, 3, '2026-09-05T18:56:25Z')
			],
			FINAL
		);

		expect(ordered.map((p) => p.id)).toEqual([4, 9]);
	});

	it('leaves predictions alone while the game has no score', () => {
		const input = [pick(1, 'A', 54, 3, '2026-09-01T12:00:00Z')];
		expect(sortPredictions(input, { homeScore: null, awayScore: null })).toBe(input);
	});
});

describe('determineCoffeeWinner', () => {
	const entries = [
		{ ...pick(1, 'Mark', 54, 3, '2026-08-19T00:20:41Z'), userId: 10 },
		{ ...pick(2, 'Patrick', 54, 3, '2026-09-05T18:56:25Z'), userId: 20 },
		{ ...pick(3, 'Mike', 56, 6, '2026-09-04T12:00:00Z'), userId: 30 }
	];

	it('returns exactly one winner when two players tie', () => {
		expect(determineCoffeeWinner(entries, FINAL, [10, 20, 30])).toBe(10);
	});

	it('skips players who are not betting this season', () => {
		expect(determineCoffeeWinner(entries, FINAL, [30])).toBe(30);
	});

	it('has no winner when nobody is betting', () => {
		expect(determineCoffeeWinner(entries, FINAL, [])).toBeNull();
	});

	it('has no winner before the game finishes', () => {
		expect(determineCoffeeWinner(entries, { homeScore: null, awayScore: null }, [10])).toBeNull();
	});
});

describe('tiebreakNotes', () => {
	it('explains an earlier pick to both sides of the tie', () => {
		const ordered = [
			pick(1, 'Mark Kelly', 54, 3, '2026-08-19T00:20:41Z'),
			pick(2, 'Patrick Shuff', 54, 3, '2026-09-05T18:56:25Z'),
			pick(3, 'Mike Nardone', 56, 6, '2026-09-04T12:00:00Z')
		];

		const notes = tiebreakNotes(ordered, FINAL);

		expect(notes.get(1)).toContain('Tied at 2 off with Patrick Shuff');
		expect(notes.get(1)).toContain('Mark Kelly ranks higher — locked in the pick first');
		expect(notes.get(2)).toContain('Mark Kelly ranks higher');
		// Nobody tied with Mike, so there's nothing to explain.
		expect(notes.has(3)).toBe(false);
	});

	it('credits the winning side when that is what separated them', () => {
		const ordered = [
			pick(1, 'Called the win', 22, 20, '2026-09-04T12:00:00Z'),
			pick(2, 'Called a tie', 21, 21, '2026-09-01T12:00:00Z')
		];

		const notes = tiebreakNotes(ordered, { homeScore: 21, awayScore: 20 });

		expect(notes.get(2)).toContain('Called the win ranks higher — picked the winning side');
	});

	it('lists everyone in a three-way tie for the leader', () => {
		const ordered = [
			pick(1, 'A', 54, 3, '2026-09-01T12:00:00Z'),
			pick(2, 'B', 54, 3, '2026-09-02T12:00:00Z'),
			pick(3, 'C', 54, 3, '2026-09-03T12:00:00Z')
		];

		const notes = tiebreakNotes(ordered, FINAL);

		expect(notes.get(1)).toContain('Tied at 2 off with B and C');
		expect(notes.get(3)).toContain('Tied at 2 off with B');
	});
});

describe('compareStandings', () => {
	it('puts coffee wins ahead of accuracy', () => {
		expect(
			compareStandings({ coffeeWins: 1, avgDelta: 14 }, { coffeeWins: 0, avgDelta: 2 })
		).toBeLessThan(0);
	});

	it('breaks equal coffee wins on the lower average', () => {
		expect(
			compareStandings({ coffeeWins: 0, avgDelta: 3 }, { coffeeWins: 0, avgDelta: 14 })
		).toBeLessThan(0);
	});

	it('sorts members with nothing scored yet to the bottom', () => {
		expect(
			compareStandings({ coffeeWins: 0, avgDelta: null }, { coffeeWins: 0, avgDelta: 14 })
		).toBeGreaterThan(0);
	});
});

describe('rankStandings', () => {
	it('ranks the whole field, not just the coffee winners', () => {
		const ranked = rankStandings([
			{ name: 'Jon', coffeeWins: 0, avgDelta: 14 },
			{ name: 'Mark', coffeeWins: 1, avgDelta: 2 },
			{ name: 'Mike', coffeeWins: 0, avgDelta: 3 },
			{ name: 'Patrick', coffeeWins: 0, avgDelta: 2 }
		]);

		expect(ranked.map((e) => [e.name, e.rank])).toEqual([
			['Mark', 1],
			['Patrick', 2],
			['Mike', 3],
			['Jon', 4]
		]);
	});

	it('shares a place for dead-even players and skips the next one', () => {
		const ranked = rankStandings([
			{ name: 'Mark', coffeeWins: 1, avgDelta: 2 },
			{ name: 'Patrick', coffeeWins: 1, avgDelta: 2 },
			{ name: 'Mike', coffeeWins: 0, avgDelta: 3 }
		]);

		expect(ranked.map((e) => e.rank)).toEqual([1, 1, 3]);
	});

	it('keeps the incoming order for players it considers identical', () => {
		const ranked = rankStandings([
			{ name: 'Abe', coffeeWins: 0, avgDelta: null },
			{ name: 'Zed', coffeeWins: 0, avgDelta: null }
		]);

		expect(ranked.map((e) => [e.name, e.rank])).toEqual([
			['Abe', 1],
			['Zed', 1]
		]);
	});
});
