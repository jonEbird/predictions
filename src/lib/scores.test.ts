import { describe, it, expect } from 'vitest';
import {
	marginLabel,
	ourMargin,
	findExtremes,
	extremeEmoji,
	EXTREME_LABELS,
	OUTLIER_GAP
} from './scores';

const OSU_HOME = { homeTeam: 'OSU', awayTeam: 'Michigan' };
const OSU_AWAY = { homeTeam: 'Texas', awayTeam: 'OSU' };

/** Build a pick whose our-margin is `margin`, from OSU's side of `game`. */
function pickWithMargin(id: number, margin: number, osuIsHome: boolean) {
	return osuIsHome
		? { id, homeScore: 20 + margin, awayScore: 20 }
		: { id, homeScore: 20, awayScore: 20 + margin };
}

describe('marginLabel', () => {
	it('names the side that comes out ahead', () => {
		expect(marginLabel(31, 17, OSU_HOME)).toBe('OSU by 14');
		expect(marginLabel(17, 31, OSU_HOME)).toBe('Michigan by 14');
	});

	it('calls an even score a tie', () => {
		expect(marginLabel(21, 21, OSU_HOME)).toBe('Tie');
	});
});

describe('ourMargin', () => {
	it('reads the margin from our side when we are at home', () => {
		expect(ourMargin({ homeScore: 31, awayScore: 17 }, OSU_HOME, 'OSU')).toBe(14);
	});

	it('flips the sign when we are the away team', () => {
		expect(ourMargin({ homeScore: 31, awayScore: 17 }, OSU_AWAY, 'OSU')).toBe(-14);
	});

	it('gives up when the group has no team set', () => {
		expect(ourMargin({ homeScore: 31, awayScore: 17 }, OSU_HOME, null)).toBeNull();
	});

	it('gives up when our team is not in this game', () => {
		expect(ourMargin({ homeScore: 31, awayScore: 17 }, OSU_HOME, 'Purdue')).toBeNull();
	});
});

describe('extremeEmoji', () => {
	it('always gives the same face for the same pick', () => {
		// The page is server-rendered; a face that changed between render and
		// hydration would visibly flip after load.
		expect(extremeEmoji('optimist', 42)).toBe(extremeEmoji('optimist', 42));
	});

	it('varies across picks', () => {
		const ids = [1, 2, 3, 4, 5, 6];

		expect(new Set(ids.map((id) => extremeEmoji('optimist', id))).size).toBe(
			EXTREME_LABELS.optimist.emojis.length
		);
		expect(new Set(ids.map((id) => extremeEmoji('pessimist', id))).size).toBe(
			EXTREME_LABELS.pessimist.emojis.length
		);
	});

	it('only ever returns a face from the extreme it was asked for', () => {
		for (const id of [0, 1, 2, 3, 97]) {
			expect(EXTREME_LABELS.optimist.emojis).toContain(extremeEmoji('optimist', id));
			expect(EXTREME_LABELS.pessimist.emojis).toContain(extremeEmoji('pessimist', id));
		}
	});

	it('keeps the two sets distinct, so a face never reads both ways', () => {
		const overlap = EXTREME_LABELS.optimist.emojis.filter((e) =>
			EXTREME_LABELS.pessimist.emojis.includes(e)
		);

		expect(overlap).toEqual([]);
	});
});

describe('findExtremes', () => {	it('flags both ends when each is clear of the pack', () => {
		const picks = [-10, 0, 1, 2, 12].map((m, i) => pickWithMargin(i + 1, m, true));

		const flags = findExtremes(picks, OSU_HOME, 'OSU');

		expect(flags.get(1)).toBe('pessimist');
		expect(flags.get(5)).toBe('optimist');
		expect(flags.size).toBe(2);
	});

	it('flags nobody when the group is bunched together', () => {
		const picks = [0, 2, 3, 5, 7].map((m, i) => pickWithMargin(i + 1, m, true));

		expect(findExtremes(picks, OSU_HOME, 'OSU').size).toBe(0);
	});

	it('flags one end without the other', () => {
		const picks = [-10, 0, 1, 2, 3].map((m, i) => pickWithMargin(i + 1, m, true));

		const flags = findExtremes(picks, OSU_HOME, 'OSU');

		expect(flags.get(1)).toBe('pessimist');
		expect(flags.size).toBe(1);
	});

	it('lets a pick tied at the extreme off the hook', () => {
		// Two people share the high pick, so neither stuck their neck out alone.
		const picks = [0, 1, 2, 20, 20].map((m, i) => pickWithMargin(i + 1, m, true));

		const flags = findExtremes(picks, OSU_HOME, 'OSU');

		expect(flags.has(4)).toBe(false);
		expect(flags.has(5)).toBe(false);
	});

	it('treats a gap of exactly OUTLIER_GAP as clear enough', () => {
		const picks = [0, 1, 2, 2 + OUTLIER_GAP].map((m, i) => pickWithMargin(i + 1, m, true));

		expect(findExtremes(picks, OSU_HOME, 'OSU').get(4)).toBe('optimist');
	});

	it('reads optimism from our side when we are the away team', () => {
		// Same raw scores as the home case, so a naive home-minus-away reading
		// would name the wrong two people.
		const picks = [-10, 0, 1, 2, 12].map((m, i) => pickWithMargin(i + 1, m, false));

		const flags = findExtremes(picks, OSU_AWAY, 'OSU');

		expect(flags.get(1)).toBe('pessimist');
		expect(flags.get(5)).toBe('optimist');
	});

	it('stays quiet for a group too small to have a pack', () => {
		const picks = [-20, 0, 20].map((m, i) => pickWithMargin(i + 1, m, true));

		expect(findExtremes(picks, OSU_HOME, 'OSU').size).toBe(0);
	});

	it('stays quiet when there is no rooting interest to judge against', () => {
		const picks = [-10, 0, 1, 2, 12].map((m, i) => pickWithMargin(i + 1, m, true));

		expect(findExtremes(picks, OSU_HOME, null).size).toBe(0);
	});
});
