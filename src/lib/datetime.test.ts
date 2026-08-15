import { describe, it, expect } from 'vitest';
import {
	parseGameTimeET,
	easternWallClockToUtc,
	formatGameTimeInput,
	formatET,
	easternAbbreviation
} from './datetime';

/** ISO of the instant, so assertions are timezone-independent. */
const iso = (d: Date) => d.toISOString();

describe('easternWallClockToUtc', () => {
	it('converts an EDT wall clock (UTC-4)', () => {
		expect(iso(easternWallClockToUtc(2026, 9, 12, 19, 30))).toBe('2026-09-12T23:30:00.000Z');
	});

	it('converts an EST wall clock (UTC-5)', () => {
		expect(iso(easternWallClockToUtc(2026, 1, 3, 12, 0))).toBe('2026-01-03T17:00:00.000Z');
	});

	it('handles the evening before the spring-forward boundary', () => {
		// DST begins 2026-03-08 02:00 ET.
		expect(iso(easternWallClockToUtc(2026, 3, 7, 20, 0))).toBe('2026-03-08T01:00:00.000Z');
	});

	it('handles the evening after the spring-forward boundary', () => {
		expect(iso(easternWallClockToUtc(2026, 3, 8, 20, 0))).toBe('2026-03-09T00:00:00.000Z');
	});

	it('handles the fall-back boundary', () => {
		// DST ends 2026-11-01 02:00 ET.
		expect(iso(easternWallClockToUtc(2026, 11, 1, 20, 0))).toBe('2026-11-02T01:00:00.000Z');
	});
});

describe('parseGameTimeET', () => {
	const cases: Array<[string, string]> = [
		['Sep 12 7:30pm', '2026-09-12T23:30:00.000Z'],
		['sep 12 7:30 pm', '2026-09-12T23:30:00.000Z'],
		['September 12, 2026 at 7:30 PM', '2026-09-12T23:30:00.000Z'],
		['Sat, Sep 12 7:30 PM', '2026-09-12T23:30:00.000Z'],
		['Saturday September 12 7:30pm', '2026-09-12T23:30:00.000Z'],
		['12 Sep 7:30pm', '2026-09-12T23:30:00.000Z'],
		['9/12 7:30pm', '2026-09-12T23:30:00.000Z'],
		['9/12/2026 7:30 pm', '2026-09-12T23:30:00.000Z'],
		['9/12/26 7:30 pm', '2026-09-12T23:30:00.000Z'],
		['2026-09-12 19:30', '2026-09-12T23:30:00.000Z'],
		['2026-09-12T19:30', '2026-09-12T23:30:00.000Z'],
		['Sep 12 7:30 PM ET', '2026-09-12T23:30:00.000Z'],
		['Sep 12 7:30 PM EDT', '2026-09-12T23:30:00.000Z'],
		['Sep 12 12:00pm', '2026-09-12T16:00:00.000Z']
	];

	for (const [input, expected] of cases) {
		it(`parses ${JSON.stringify(input)}`, () => {
			const result = parseGameTimeET(input, 2026);
			expect(result.error).toBeUndefined();
			expect(iso(result.date!)).toBe(expected);
		});
	}

	it('maps 12 AM to midnight and 12 PM to noon', () => {
		expect(iso(parseGameTimeET('Sep 12 12:00 AM', 2026).date!)).toBe('2026-09-12T04:00:00.000Z');
		expect(iso(parseGameTimeET('Sep 12 12:00 PM', 2026).date!)).toBe('2026-09-12T16:00:00.000Z');
	});

	it('accepts 24-hour times without a meridiem', () => {
		expect(iso(parseGameTimeET('Sep 12 19:30', 2026).date!)).toBe('2026-09-12T23:30:00.000Z');
		expect(iso(parseGameTimeET('Sep 12 00:30', 2026).date!)).toBe('2026-09-12T04:30:00.000Z');
	});

	it('defaults the year to the season when omitted', () => {
		expect(iso(parseGameTimeET('Sep 12 7:30pm', 2027).date!)).toBe('2027-09-12T23:30:00.000Z');
	});

	it('prefers an explicit year over the season default', () => {
		expect(iso(parseGameTimeET('Sep 12 2029 7:30pm', 2026).date!)).toBe('2029-09-12T23:30:00.000Z');
	});

	describe('rejects ambiguous or invalid input', () => {
		const bad: Array<[string, RegExp]> = [
			['', /enter a game time/i],
			['   ', /enter a game time/i],
			['Sep 12', /kickoff time/i],
			['Sep 12 7:30', /needs AM or PM/i],
			['7:30 PM', /add a date/i],
			['Sep 32 7:30pm', /not a valid day/i],
			['Feb 30 7:30pm', /not a valid day/i],
			['13/45 7:30pm', /not a valid (month|day)/i],
			['Sep 12 25:00', /not a valid hour/i],
			['Sep 12 7:99pm', /not a valid minute/i],
			['Sep 12 13:30 pm', /not a valid hour with PM/i],
			['Smarch 12 7:30pm', /not a month/i],
			['next tuesday evening', /could not read a date|kickoff time/i]
		];

		for (const [input, pattern] of bad) {
			it(`rejects ${JSON.stringify(input)}`, () => {
				const result = parseGameTimeET(input, 2026);
				expect(result.date).toBeUndefined();
				expect(result.error).toMatch(pattern);
			});
		}
	});

	it('allows Feb 29 in a leap year', () => {
		expect(iso(parseGameTimeET('Feb 29 2028 7:30pm', 2028).date!)).toBe('2028-03-01T00:30:00.000Z');
	});
});

describe('round-tripping the edit form', () => {
	// The old bug: opening the edit form and saving without edits shifted the time.
	const instants = [
		'2026-09-12T23:30:00.000Z', // EDT evening
		'2026-01-03T17:00:00.000Z', // EST midday
		'2026-11-01T21:00:00.000Z', // day DST ends
		'2026-03-08T18:00:00.000Z' // day DST begins
	];

	for (const instant of instants) {
		it(`re-saving ${instant} unchanged does not shift it`, () => {
			const shown = formatGameTimeInput(instant);
			const reparsed = parseGameTimeET(shown, 2026);
			expect(reparsed.error).toBeUndefined();
			expect(iso(reparsed.date!)).toBe(instant);
		});
	}
});

describe('formatET', () => {
	it('formats in Eastern regardless of the ambient timezone', () => {
		const formatted = formatET('2026-09-12T23:30:00.000Z', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
		expect(formatted).toContain('7:30');
		expect(formatted).toContain('Sep 12');
		expect(formatted).toContain('Sat');
	});

	it('labels daylight and standard time correctly', () => {
		expect(easternAbbreviation('2026-09-12T23:30:00.000Z')).toBe('EDT');
		expect(easternAbbreviation('2026-01-03T17:00:00.000Z')).toBe('EST');
	});
});
