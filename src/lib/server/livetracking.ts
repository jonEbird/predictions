import { db } from '$lib/db';
import { games, type Game } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { getGamesNeedingLiveUpdate } from './queries/games';

// ESPN's public scoreboard JSON -- the same unauthenticated endpoint espn.com
// itself calls client-side. No API key, but also no stability guarantee: it's
// undocumented and the response shape could change without notice.
const ESPN_SCOREBOARD_URL =
	'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard';

const FETCH_TIMEOUT_MS = 10_000;

// A game an admin forgets to finalize shouldn't get polled forever.
const MAX_POLL_WINDOW_HOURS = 7;

interface EspnTeamRef {
	abbreviation?: string;
	location?: string;
	name?: string;
	shortDisplayName?: string;
	displayName?: string;
}

interface EspnCompetitor {
	team: EspnTeamRef;
	score?: string;
}

interface EspnEvent {
	id: string;
	status?: { type?: { state?: string } };
	competitions?: Array<{ competitors?: EspnCompetitor[] }>;
}

interface EspnScoreboardResponse {
	events?: EspnEvent[];
}

function normalize(name: string): string {
	return name.trim().toLowerCase();
}

// Our `games` table stores plain team names ("OSU", "Texas") with no ESPN ID
// to match against, so compare against every name ESPN gives a team.
function teamRefMatches(ref: EspnTeamRef, ourTeamName: string): boolean {
	const target = normalize(ourTeamName);
	const candidates = [ref.abbreviation, ref.location, ref.name, ref.shortDisplayName, ref.displayName]
		.filter((c): c is string => Boolean(c))
		.map(normalize);
	return candidates.some((c) => c === target || c.includes(target) || target.includes(c));
}

async function fetchEspnScoreboard(date: Date): Promise<EspnEvent[]> {
	const dateParam = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

	try {
		const response = await fetch(`${ESPN_SCOREBOARD_URL}?dates=${dateParam}`, {
			signal: controller.signal
		});
		if (!response.ok) {
			throw new Error(`ESPN scoreboard request failed: ${response.status}`);
		}
		const data = (await response.json()) as EspnScoreboardResponse;
		return data.events ?? [];
	} finally {
		clearTimeout(timeout);
	}
}

function findMatchingEvent(events: EspnEvent[], game: Pick<Game, 'homeTeam' | 'awayTeam'>): EspnEvent | undefined {
	return events.find((event) => {
		const competitors = event.competitions?.[0]?.competitors ?? [];
		if (competitors.length !== 2) return false;
		const [a, b] = competitors;
		const matchesAsIs = teamRefMatches(a.team, game.homeTeam) && teamRefMatches(b.team, game.awayTeam);
		const matchesSwapped = teamRefMatches(a.team, game.awayTeam) && teamRefMatches(b.team, game.homeTeam);
		return matchesAsIs || matchesSwapped;
	});
}

function extractScore(event: EspnEvent, teamName: string): number | null {
	const competitors = event.competitions?.[0]?.competitors ?? [];
	const competitor = competitors.find((c) => teamRefMatches(c.team, teamName));
	if (!competitor?.score) return null;
	const score = parseInt(competitor.score, 10);
	return Number.isNaN(score) ? null : score;
}

/**
 * Polls ESPN for games that have kicked off but aren't finished yet, and
 * updates their live score/status. This only ever sets status to "live" --
 * marking a game "finished" (which triggers delta/rank/coffee-winner
 * calculations) stays a manual admin action via the final-score form.
 */
export async function pollLiveGames(): Promise<void> {
	const windowStart = new Date(Date.now() - MAX_POLL_WINDOW_HOURS * 60 * 60 * 1000);
	const inProgressGames = await getGamesNeedingLiveUpdate(windowStart);

	if (inProgressGames.length === 0) {
		console.log('🏈 No live games to poll');
		return;
	}

	// Cache scoreboard responses per day so multiple games on the same date
	// (unlikely for a single-team pick'em, but cheap to guard against) only
	// hit ESPN once.
	const scoreboardCache = new Map<string, EspnEvent[]>();

	for (const game of inProgressGames) {
		try {
			const gameTime = new Date(game.gameTime);
			const dateKey = gameTime.toISOString().slice(0, 10);

			let events = scoreboardCache.get(dateKey);
			if (!events) {
				events = await fetchEspnScoreboard(gameTime);
				scoreboardCache.set(dateKey, events);
			}

			const match = findMatchingEvent(events, game);
			if (!match) {
				console.log(`🏈 No ESPN match for game ${game.id} (${game.awayTeam} @ ${game.homeTeam})`);
				continue;
			}

			// 'pre' = not started yet on ESPN's side, 'in' = live, 'post' = final.
			const state = match.status?.type?.state;
			if (state !== 'in' && state !== 'post') {
				continue;
			}

			const homeScore = extractScore(match, game.homeTeam);
			const awayScore = extractScore(match, game.awayTeam);
			if (homeScore === null || awayScore === null) {
				continue;
			}

			const unchanged =
				game.status === 'live' && game.homeScore === homeScore && game.awayScore === awayScore;
			if (unchanged) {
				continue;
			}

			await db
				.update(games)
				.set({ homeScore, awayScore, status: 'live', updatedAt: new Date() })
				.where(eq(games.id, game.id));

			console.log(
				`🏈 Live score updated for game ${game.id}: ${game.awayTeam} ${awayScore} @ ${game.homeTeam} ${homeScore}`
			);
		} catch (error) {
			// One game's lookup failing (bad match, ESPN hiccup) shouldn't stop
			// the rest of the poll from running.
			console.error(`❌ Failed to poll live score for game ${game.id}:`, error);
		}
	}
}
