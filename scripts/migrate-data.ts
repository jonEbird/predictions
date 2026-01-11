import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import bcrypt from 'bcryptjs';
import * as schema from '../src/lib/db/schema';
import { sql } from 'drizzle-orm';

/**
 * Migration script to convert old Python SQLite database to new SvelteKit schema
 *
 * Old schema (Python/SQLAlchemy):
 * - people -> users
 * - groupplay -> groups
 * - membership -> memberships
 * - games -> games
 * - predictions -> predictions
 * - ingamescores -> in_game_scores
 * - betting -> group_games
 *
 * Key changes:
 * 1. Hash plaintext passwords
 * 2. Rename tables/columns to camelCase
 * 3. Add timestamps
 * 4. Restructure betting data
 */

// Configuration
const OLD_DB_PATH = '../predictions.sqlite'; // Old database (parent directory)
const NEW_DB_PATH = './predictions.db'; // New database (current app directory)

interface OldPerson {
	id: number;
	name: string;
	nickname: string | null;
	email: string;
	phonenumber: string | null;
	password: string;
	mugshot: string | null;
	betting: number; // 0 or 1 (SQLite boolean)
}

interface OldGroupPlay {
	id: number;
	name: string;
	description: string | null;
	season: number;
	hometeam: string | null;
	shorturl: string;
	created: string; // ISO date string
	picture: string | null;
	prize: string | null;
	prize_pic: string | null;
	admin_id: number;
}

interface OldMembership {
	id: number;
	person_id: number;
	group_id: number;
}

interface OldGame {
	id: number;
	hometeam: string;
	awayteam: string;
	hscore: number;
	ascore: number;
	gametime: string; // ISO date string
	season: number;
	odds: string | null;
}

interface OldPrediction {
	id: number;
	home: number;
	away: number;
	dt: string; // ISO date string
	person_id: number;
	game_id: number;
	group_id: number;
}

interface OldInGameScore {
	id: number;
	home: number;
	away: number;
	comment: string | null;
	person_id: number;
	game_id: number;
	group_id: number;
}

interface OldBetting {
	id: number;
	game_id: number;
	group_id: number;
}

async function migrate() {
	console.log('🚀 Starting migration from old database to new schema...\n');

	// Open databases
	console.log('📂 Opening databases...');
	const oldDb = new Database(OLD_DB_PATH, { readonly: true });
	const newDb = drizzle(new Database(NEW_DB_PATH), { schema });

	try {
		// Stats
		let stats = {
			users: 0,
			groups: 0,
			memberships: 0,
			games: 0,
			predictions: 0,
			inGameScores: 0,
			groupGames: 0
		};

		// ============================================
		// 1. Migrate Users (people -> users)
		// ============================================
		console.log('\n👥 Migrating users...');
		const oldPeople = oldDb.prepare('SELECT * FROM people').all() as OldPerson[];

		for (const person of oldPeople) {
			console.log(`  - Migrating user: ${person.name} (${person.email})`);

			// Hash the plaintext password
			const passwordHash = await bcrypt.hash(person.password, 10);

			await newDb.insert(schema.users).values({
				id: person.id,
				name: person.name,
				nickname: person.nickname,
				email: person.email,
				phoneNumber: person.phonenumber,
				passwordHash,
				mugshotUrl: person.mugshot,
				emailNotifications: true,
				smsNotifications: person.phonenumber ? true : false,
				createdAt: new Date(),
				updatedAt: new Date(),
				lastLoginAt: null,
				deletedAt: null
			});

			stats.users++;
		}

		console.log(`✅ Migrated ${stats.users} users`);

		// ============================================
		// 2. Migrate Groups (groupplay -> groups)
		// ============================================
		console.log('\n🏈 Migrating groups...');
		const oldGroups = oldDb.prepare('SELECT * FROM groupplay').all() as OldGroupPlay[];

		// Determine default owner (first user if admin_id is NULL)
		const defaultOwnerId = oldPeople.length > 0 ? oldPeople[0].id : 1;

		for (const group of oldGroups) {
			console.log(`  - Migrating group: ${group.name} (${group.season})`);

			// Use admin_id if it exists, otherwise use default owner
			const ownerId = group.admin_id || defaultOwnerId;

			if (!group.admin_id) {
				console.log(`    ⚠️  No admin_id found, setting owner to user ${ownerId} (${oldPeople[0]?.name || 'unknown'})`);
			}

			await newDb.insert(schema.groups).values({
				id: group.id,
				name: group.name,
				slug: group.shorturl, // Keep original slug (e.g., "bucknuts")
				description: group.description,
				season: group.season,
				homeTeam: group.hometeam,
				pictureUrl: group.picture,
				prize: group.prize,
				prizeImageUrl: group.prize_pic,
				primaryColor: '#BB0000', // Scarlet (Ohio State)
				accentColor: '#666666', // Grey (Ohio State)
				ownerId,
				createdAt: group.created ? new Date(group.created) : new Date(),
				updatedAt: new Date()
			});

			stats.groups++;
		}

		console.log(`✅ Migrated ${stats.groups} groups`);

		// ============================================
		// 3. Migrate Memberships
		// ============================================
		console.log('\n👫 Migrating memberships...');
		const oldMemberships = oldDb.prepare('SELECT * FROM membership').all() as OldMembership[];

		// Get old person betting preferences
		const personBettingMap = new Map<number, boolean>();
		for (const person of oldPeople) {
			personBettingMap.set(person.id, person.betting === 1);
		}

		for (const membership of oldMemberships) {
			const betting = personBettingMap.get(membership.person_id) || false;

			await newDb.insert(schema.memberships).values({
				id: membership.id,
				userId: membership.person_id,
				groupId: membership.group_id,
				betting, // Migrate person.betting to membership.betting
				role: 'member',
				joinedAt: new Date()
			});

			stats.memberships++;
		}

		console.log(`✅ Migrated ${stats.memberships} memberships`);

		// ============================================
		// 4. Migrate Games
		// ============================================
		console.log('\n🏟️  Migrating games...');
		const oldGames = oldDb.prepare('SELECT * FROM games').all() as OldGame[];

		for (const game of oldGames) {
			// Determine game status based on scores
			let status = 'scheduled';
			if (game.hscore >= 0 && game.ascore >= 0) {
				if (game.hscore === 0 && game.ascore === 0) {
					status = 'canceled';
				} else {
					status = 'finished';
				}
			}

			await newDb.insert(schema.games).values({
				id: game.id,
				homeTeam: game.hometeam,
				awayTeam: game.awayteam,
				gameTime: new Date(game.gametime),
				season: game.season,
				homeScore: game.hscore >= 0 ? game.hscore : null,
				awayScore: game.ascore >= 0 ? game.ascore : null,
				status,
				// Parse odds if it's HTML/text, for now just store as source
				spreadHome: null,
				overUnder: null,
				oddsSource: game.odds || null,
				oddsUpdatedAt: null,
				createdAt: new Date(),
				updatedAt: new Date()
			});

			stats.games++;
		}

		console.log(`✅ Migrated ${stats.games} games`);

		// ============================================
		// 5. Migrate Group-Game Associations (betting -> group_games)
		// ============================================
		console.log('\n🔗 Migrating group-game associations...');
		const oldBetting = oldDb.prepare('SELECT * FROM betting').all() as OldBetting[];

		for (const bet of oldBetting) {
			await newDb.insert(schema.groupGames).values({
				groupId: bet.group_id,
				gameId: bet.game_id,
				createdAt: new Date()
			});

			stats.groupGames++;
		}

		console.log(`✅ Migrated ${stats.groupGames} group-game associations`);

		// ============================================
		// 6. Migrate Predictions
		// ============================================
		console.log('\n🎯 Migrating predictions...');
		const oldPredictions = oldDb.prepare('SELECT * FROM predictions').all() as OldPrediction[];

		for (const pred of oldPredictions) {
			// Calculate delta if game is finished
			const game = oldGames.find((g) => g.id === pred.game_id);
			let delta = null;

			if (game && game.hscore >= 0 && game.ascore >= 0) {
				delta = Math.abs(game.hscore - pred.home) + Math.abs(game.ascore - pred.away);
			}

			await newDb.insert(schema.predictions).values({
				id: pred.id,
				userId: pred.person_id,
				gameId: pred.game_id,
				groupId: pred.group_id,
				homeScore: pred.home,
				awayScore: pred.away,
				delta,
				rank: null, // Will be calculated later
				wonCoffee: false, // Will be calculated later
				createdAt: pred.dt ? new Date(pred.dt) : new Date(),
				updatedAt: new Date()
			});

			stats.predictions++;
		}

		console.log(`✅ Migrated ${stats.predictions} predictions`);

		// ============================================
		// 7. Migrate In-Game Scores
		// ============================================
		console.log('\n📊 Migrating in-game scores...');
		const oldInGameScores = oldDb
			.prepare('SELECT * FROM ingamescores')
			.all() as OldInGameScore[];

		for (const score of oldInGameScores) {
			await newDb.insert(schema.inGameScores).values({
				gameId: score.game_id,
				userId: score.person_id,
				groupId: score.group_id,
				homeScore: score.home,
				awayScore: score.away,
				comment: score.comment,
				createdAt: new Date() // No timestamp in old schema, use current date
			});

			stats.inGameScores++;
		}

		console.log(`✅ Migrated ${stats.inGameScores} in-game scores`);

		// ============================================
		// 8. Calculate Rankings for Finished Games
		// ============================================
		console.log('\n🏆 Calculating rankings for finished games...');

		const finishedGames = oldGames.filter(
			(g) => g.hscore >= 0 && g.ascore >= 0 && !(g.hscore === 0 && g.ascore === 0)
		);

		for (const game of finishedGames) {
			// Get all predictions for this game
			const gamePredictions = oldPredictions.filter((p) => p.game_id === game.id);

			// Calculate deltas and sort
			const predictionsWithDelta = gamePredictions.map((p) => ({
				id: p.id,
				userId: p.person_id,
				groupId: p.group_id,
				delta: Math.abs(game.hscore - p.home) + Math.abs(game.ascore - p.away),
				homeScore: p.home,
				awayScore: p.away,
				pickedWinner:
					game.hscore > game.ascore
						? p.home > p.away
						: game.hscore < game.ascore
							? p.home < p.away
							: false
			}));

			// Sort by delta, then by picked winner
			predictionsWithDelta.sort((a, b) => {
				if (a.delta !== b.delta) return a.delta - b.delta;
				if (a.pickedWinner && !b.pickedWinner) return -1;
				if (!a.pickedWinner && b.pickedWinner) return 1;
				return 0;
			});

			// Assign ranks and determine coffee winner
			for (let i = 0; i < predictionsWithDelta.length; i++) {
				const pred = predictionsWithDelta[i];

				// Get membership to check if they're betting
				const membership = oldMemberships.find(
					(m) => m.person_id === pred.userId && m.group_id === pred.groupId
				);

				const person = oldPeople.find((p) => p.id === pred.userId);
				const isBetting = person?.betting === 1;

				// First place among betters wins coffee
				const wonCoffee = isBetting && i === 0;

				await newDb
					.update(schema.predictions)
					.set({
						rank: i + 1,
						wonCoffee,
						delta: pred.delta
					})
					.where(sql`id = ${pred.id}`);
			}
		}

		console.log(`✅ Calculated rankings for ${finishedGames.length} finished games`);

		// ============================================
		// Summary
		// ============================================
		console.log('\n' + '='.repeat(50));
		console.log('✨ Migration Complete!');
		console.log('='.repeat(50));
		console.log('\nMigration Summary:');
		console.log(`  👥 Users:                ${stats.users}`);
		console.log(`  🏈 Groups:               ${stats.groups}`);
		console.log(`  👫 Memberships:          ${stats.memberships}`);
		console.log(`  🏟️  Games:                ${stats.games}`);
		console.log(`  🔗 Group-Game Links:     ${stats.groupGames}`);
		console.log(`  🎯 Predictions:          ${stats.predictions}`);
		console.log(`  📊 In-Game Scores:       ${stats.inGameScores}`);

		console.log('\n✅ All data migrated successfully!');
		console.log('\n📝 Next steps:');
		console.log('  1. Verify data in Drizzle Studio: npm run db:studio');
		console.log('  2. Test login with migrated users');
		console.log('  3. Verify groups and games display correctly');
		console.log('  4. Check that predictions and rankings are accurate');
		console.log('\n⚠️  Note: User passwords have been re-hashed with bcrypt');
		console.log(
			'   Users will need to use their ORIGINAL passwords to log in (the ones from the old database)'
		);
	} catch (error) {
		console.error('\n❌ Migration failed:', error);
		throw error;
	} finally {
		oldDb.close();
	}
}

// Run migration
migrate()
	.then(() => {
		console.log('\n🎉 Migration script completed successfully!');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\n💥 Migration script failed:', error);
		process.exit(1);
	});
