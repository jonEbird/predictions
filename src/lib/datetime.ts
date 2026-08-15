/**
 * Game times are anchored to US Eastern time.
 *
 * Kickoff times are an Eastern-time fact, so a game at "7:30 PM" is 7:30 PM ET for
 * everyone — the admin entering it, a member reading the site from another state, and
 * the reminder emails. Nothing here depends on the server's or the browser's timezone,
 * which is what previously made prod (UTC container) and dev (local machine) disagree.
 *
 * Timestamps are still stored as true UTC instants; Eastern is the presentation and
 * input anchor only.
 */

export const ET_TIME_ZONE = 'America/New_York';

const MONTHS: Record<string, number> = {
	jan: 1, january: 1,
	feb: 2, february: 2,
	mar: 3, march: 3,
	apr: 4, april: 4,
	may: 5,
	jun: 6, june: 6,
	jul: 7, july: 7,
	aug: 8, august: 8,
	sep: 9, sept: 9, september: 9,
	oct: 10, october: 10,
	nov: 11, november: 11,
	dec: 12, december: 12
};

const WEEKDAYS =
	/\b(sun|sunday|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday)\b\.?/g;

/**
 * Offset in milliseconds between Eastern time and UTC at a given instant.
 * Positive west of Greenwich is negative here (ET is UTC-4 or UTC-5).
 */
function easternOffset(timestamp: number): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: ET_TIME_ZONE,
		hour12: false,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).formatToParts(new Date(timestamp));

	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
	// Intl can emit hour 24 for midnight in some engines.
	const hour = get('hour') % 24;

	const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
	return asUtc - timestamp;
}

/**
 * Build a UTC Date from an Eastern-time wall clock.
 *
 * Resolved iteratively because the offset itself depends on the instant: the first
 * guess picks an offset, and near a DST boundary that offset may not be the one that
 * actually applies at the resulting instant.
 */
export function easternWallClockToUtc(
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number
): Date {
	const guess = Date.UTC(year, month - 1, day, hour, minute);
	const firstOffset = easternOffset(guess);
	let timestamp = guess - firstOffset;

	const secondOffset = easternOffset(timestamp);
	if (secondOffset !== firstOffset) {
		timestamp = guess - secondOffset;
	}

	return new Date(timestamp);
}

/** Format an instant in Eastern time. Always 'en-US' so months/AM-PM read the same everywhere. */
export function formatET(
	date: Date | string | number,
	options: Intl.DateTimeFormatOptions
): string {
	return new Date(date).toLocaleString('en-US', { ...options, timeZone: ET_TIME_ZONE });
}

/** Whether an instant falls in daylight saving time, for labelling as EDT vs EST. */
export function easternAbbreviation(date: Date | string | number): 'EDT' | 'EST' {
	return easternOffset(new Date(date).getTime()) === -4 * 60 * 60 * 1000 ? 'EDT' : 'EST';
}

/**
 * Render an instant as text the parser below accepts, for pre-filling the edit form.
 * Round-tripping this through parseGameTimeET must not shift the time.
 */
export function formatGameTimeInput(date: Date | string | number): string {
	return formatET(date, {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
}

export type ParseResult =
	| { ok: true; date: Date; error?: undefined }
	| { ok: false; date?: undefined; error: string };

/**
 * Parse an admin-typed game time as Eastern time.
 *
 * Accepts the shapes someone actually types for a kickoff:
 *   "Sep 12 7:30pm", "September 12, 2026 at 7:30 PM", "9/12/2026 7:30 pm",
 *   "2026-09-12 19:30", "Sat Sep 12 3:30 PM", "12 Sep 7:30pm"
 *
 * `defaultYear` fills in an omitted year — pass the season being edited.
 */
export function parseGameTimeET(input: string, defaultYear: number): ParseResult {
	if (!input || !input.trim()) {
		return { ok: false, error: 'Enter a game time, for example "Sep 12 7:30 PM"' };
	}

	let text = input
		.toLowerCase()
		.replace(/\b(edt|est|et|eastern)\b\.?/g, ' ')
		.replace(WEEKDAYS, ' ')
		.replace(/,/g, ' ')
		.replace(/\bat\b/g, ' ')
		.replace(/\bt\b/g, ' ')
		// datetime-local style "2026-09-12T19:30" keeps its separator until here.
		.replace(/(\d)t(\d)/g, '$1 $2')
		.replace(/\s+/g, ' ')
		.trim();

	// --- time ---
	let hour: number | null = null;
	let minute = 0;
	let meridiem: string | null = null;

	const withMeridiem = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
	if (withMeridiem) {
		hour = Number(withMeridiem[1]);
		minute = withMeridiem[2] ? Number(withMeridiem[2]) : 0;
		meridiem = withMeridiem[3];
		text = text.replace(withMeridiem[0], ' ');
	} else {
		const bare = text.match(/\b(\d{1,2}):(\d{2})\b/);
		if (bare) {
			hour = Number(bare[1]);
			minute = Number(bare[2]);
			text = text.replace(bare[0], ' ');
		}
	}

	if (hour === null) {
		return { ok: false, error: 'Add a kickoff time, for example "7:30 PM"' };
	}
	if (minute > 59) {
		return { ok: false, error: `"${minute}" is not a valid minute` };
	}

	if (meridiem) {
		if (hour < 1 || hour > 12) {
			return { ok: false, error: `"${hour}" is not a valid hour with ${meridiem.toUpperCase()}` };
		}
		if (meridiem === 'pm' && hour !== 12) hour += 12;
		if (meridiem === 'am' && hour === 12) hour = 0;
	} else if (hour >= 1 && hour <= 11) {
		// 1-11 with no AM/PM is genuinely ambiguous; guessing here is how games
		// end up scheduled at 7:30 in the morning.
		return { ok: false, error: `"${hour}:${String(minute).padStart(2, '0')}" needs AM or PM` };
	} else if (hour > 23) {
		return { ok: false, error: `"${hour}" is not a valid hour` };
	}

	// --- date ---
	text = text.replace(/\s+/g, ' ').trim();
	if (!text) {
		return { ok: false, error: 'Add a date, for example "Sep 12"' };
	}

	let year: number | null = null;
	let month: number | null = null;
	let day: number | null = null;

	let match: RegExpMatchArray | null;
	if ((match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
		[year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
	} else if ((match = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?$/))) {
		month = Number(match[1]);
		day = Number(match[2]);
		if (match[3]) year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
	} else if ((match = text.match(/^([a-z]+)\.?\s+(\d{1,2})(?:\s+(\d{4}))?$/))) {
		month = MONTHS[match[1]] ?? null;
		day = Number(match[2]);
		if (match[3]) year = Number(match[3]);
		if (month === null) return { ok: false, error: `"${match[1]}" is not a month` };
	} else if ((match = text.match(/^(\d{1,2})\s+([a-z]+)\.?(?:\s+(\d{4}))?$/))) {
		day = Number(match[1]);
		month = MONTHS[match[2]] ?? null;
		if (match[3]) year = Number(match[3]);
		if (month === null) return { ok: false, error: `"${match[2]}" is not a month` };
	} else {
		return { ok: false, error: `Could not read a date from "${input.trim()}"` };
	}

	if (year === null) year = defaultYear;

	if (month < 1 || month > 12) {
		return { ok: false, error: `"${month}" is not a valid month` };
	}
	if (day < 1 || day > daysInMonth(year, month)) {
		return { ok: false, error: `"${day}" is not a valid day for that month` };
	}

	return { ok: true, date: easternWallClockToUtc(year, month, day, hour, minute) };
}

function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
