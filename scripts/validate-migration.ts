import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../src/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Validation script to verify the migration was successful
 *
 * This script:
 * 1. Compares record counts between old and new databases
 * 2. Spot-checks data integrity
 * 3. Validates relationships
 * 4. Checks for data loss
 */

const OLD_DB_PATH = '../predictions.sqlite';
const NEW_DB_PATH = './predictions.db';

interface ValidationResult {
	table: string;
	oldCount: number;
	newCount: number;
	status: 'OK' | 'WARNING' | 'ERROR';
	message?: string;
}

async function validate() {
	console.log('🔍 Starting migration validation...\n');

	const oldDb = new Database(OLD_DB_PATH, { readonly: true });
	const newDb = drizzle(new Database(NEW_DB_PATH, { readonly: true }), { schema });

	const results: ValidationResult[] = [];

	try {
		// ============================================
		// 1. Check Record Counts
		// ============================================
		console.log('📊 Comparing record counts...\n');

		// Users (people -> users)
		const oldPeopleCount = oldDb.prepare('SELECT COUNT(*) as count FROM people').get() as {
			count: number;
		};
		const newUsersCount = (
			await newDb.select({ count: sql<number>`count(*)` }).from(schema.users)
		)[0];

		results.push({
			table: 'users (people)',
			oldCount: oldPeopleCount.count,
			newCount: Number(newUsersCount.count),
			status: oldPeopleCount.count === Number(newUsersCount.count) ? 'OK' : 'ERROR'
		});

		// Groups (groupplay -> groups)
		const oldGroupsCount = oldDb.prepare('SELECT COUNT(*) as count FROM groupplay').get() as {
			count: number;
		};
		const newGroupsCount = (
			await newDb.select({ count: sql<number>`count(*)` }).from(schema.groups)
		)[0];

		results.push({
			table: 'groups (groupplay)',
			oldCount: oldGroupsCount.count,
			newCount: Number(newGroupsCount.count),
			status: oldGroupsCount.count === Number(newGroupsCount.count) ? 'OK' : 'ERROR'
		});

		// Memberships
		const oldMembershipsCount = oldDb
			.prepare('SELECT COUNT(*) as count FROM membership')
			.get() as { count: number };
		const newMembershipsCount = (
			await newDb.select({ count: sql<number>`count(*)` }).from(schema.memberships)
		)[0];

		results.push({
			table: 'memberships',
			oldCount: oldMembershipsCount.count,
			newCount: Number(newMembershipsCount.count),
			status: oldMembershipsCount.count === Number(newMembershipsCount.count) ? 'OK' : 'ERROR'
		});

		// Games
		const oldGamesCount = oldDb.prepare('SELECT COUNT(*) as count FROM games').get() as {
			count: number;
		};
		const newGamesCount = (
			await newDb.select({ count: sql<number>`count(*)` }).from(schema.games)
		)[0];

		results.push({
			table: 'games',
			oldCount: oldGamesCount.count,
			newCount: Number(newGamesCount.count),
			status: oldGamesCount.count === Number(newGamesCount.count) ? 'OK' : 'ERROR'
		});

		// Predictions
		const oldPredictionsCount = oldDb
			.prepare('SELECT COUNT(*) as count FROM predictions')
			.get() as { count: number };
		const newPredictionsCount = (
			await newDb.select({ count: sql<number>`count(*)` }).from(schema.predictions)
		)[0];

		results.push({
			table: 'predictions',
			oldCount: oldPredictionsCount.count,
			newCount: Number(newPredictionsCount.count),
			status: oldPredictionsCount.count === Number(newPredictionsCount.count) ? 'OK' : 'ERROR'
		});

		// In-game scores
		const oldInGameScoresCount = oldDb
			.prepare('SELECT COUNT(*) as count FROM ingamescores')
			.get() as { count: number };
		const newInGameScoresCount = (
			await newDb.select({ count: sql<number>`count(*)` }).from(schema.inGameScores)
		)[0];

		results.push({
			table: 'in_game_scores (ingamescores)',
			oldCount: oldInGameScoresCount.count,
			newCount: Number(newInGameScoresCount.count),
			status: oldInGameScoresCount.count === Number(newInGameScoresCount.count) ? 'OK' : 'ERROR'
		});

		// Group-game associations (betting -> group_games)
		const oldBettingCount = oldDb.prepare('SELECT COUNT(*) as count FROM betting').get() as {
			count: number;
		};
		const newGroupGamesCount = (
			await newDb.select({ count: sql<number>`count(*)` }).from(schema.groupGames)
		)[0];

		results.push({
			table: 'group_games (betting)',
			oldCount: oldBettingCount.count,
			newCount: Number(newGroupGamesCount.count),
			status: oldBettingCount.count === Number(newGroupGamesCount.count) ? 'OK' : 'ERROR'
		});

		// ============================================
		// 2. Print Results
		// ============================================
		console.log('Table                          | Old Count | New Count | Status');
		console.log('-'.repeat(70));

		for (const result of results) {
			const tableName = result.table.padEnd(30);
			const oldCount = result.oldCount.toString().padStart(9);
			const newCount = result.newCount.toString().padStart(9);
			const statusIcon = result.status === 'OK' ? '✅' : '❌';

			console.log(`${tableName} | ${oldCount} | ${newCount} | ${statusIcon} ${result.status}`);
		}

		// ============================================
		// 3. Spot Check Data Integrity
		// ============================================
		console.log('\n🔬 Spot-checking data integrity...\n');

		// Check that all users have hashed passwords
		const usersWithoutHash = await newDb
			.select({ count: sql<number>`count(*)` })
			.from(schema.users)
			.where(sql`password_hash IS NULL OR password_hash = ''`);

		if (Number(usersWithoutHash[0].count) > 0) {
			console.log(`❌ ERROR: ${usersWithoutHash[0].count} users without password hash`);
		} else {
			console.log('✅ All users have hashed passwords');
		}

		// Check that all groups have owners
		const groupsWithoutOwner = await newDb
			.select({ count: sql<number>`count(*)` })
			.from(schema.groups)
			.where(sql`owner_id IS NULL`);

		if (Number(groupsWithoutOwner[0].count) > 0) {
			console.log(`⚠️  WARNING: ${groupsWithoutOwner[0].count} groups without owner`);
		} else {
			console.log('✅ All groups have owners');
		}

		// Check that all predictions have valid game references
		const predictionsWithInvalidGame = await newDb.execute(sql`
			SELECT COUNT(*) as count FROM predictions p
			LEFT JOIN games g ON p.game_id = g.id
			WHERE g.id IS NULL
		`);

		const invalidGameCount = predictionsWithInvalidGame.rows[0].count as number;
		if (invalidGameCount > 0) {
			console.log(`❌ ERROR: ${invalidGameCount} predictions with invalid game references`);
		} else {
			console.log('✅ All predictions have valid game references');
		}

		// ============================================
		// 4. Check for Orphaned Records
		// ============================================
		console.log('\n🔗 Checking for orphaned records...\n');

		// Memberships without valid user
		const orphanedMemberships = await newDb.execute(sql`
			SELECT COUNT(*) as count FROM memberships m
			LEFT JOIN users u ON m.user_id = u.id
			WHERE u.id IS NULL
		`);

		const orphanedMembershipCount = orphanedMemberships.rows[0].count as number;
		if (orphanedMembershipCount > 0) {
			console.log(`❌ ERROR: ${orphanedMembershipCount} orphaned memberships`);
		} else {
			console.log('✅ No orphaned memberships');
		}

		// ============================================
		// 5. Sample Data Verification
		// ============================================
		console.log('\n📋 Sample data verification...\n');

		// Get first user from both databases
		const oldFirstUser = oldDb.prepare('SELECT * FROM people LIMIT 1').get() as any;
		const newFirstUser = await newDb.select().from(schema.users).limit(1);

		if (oldFirstUser && newFirstUser[0]) {
			console.log('First user comparison:');
			console.log(`  Old: ${oldFirstUser.name} (${oldFirstUser.email})`);
			console.log(`  New: ${newFirstUser[0].name} (${newFirstUser[0].email})`);
			console.log(
				`  Match: ${oldFirstUser.name === newFirstUser[0].name && oldFirstUser.email === newFirstUser[0].email ? '✅' : '❌'}`
			);
		}

		// ============================================
		// 6. Final Summary
		// ============================================
		console.log('\n' + '='.repeat(70));

		const hasErrors = results.some((r) => r.status === 'ERROR');
		const hasWarnings = results.some((r) => r.status === 'WARNING');

		if (!hasErrors && !hasWarnings) {
			console.log('✅ VALIDATION PASSED - Migration is successful!');
		} else if (hasWarnings && !hasErrors) {
			console.log('⚠️  VALIDATION PASSED WITH WARNINGS - Review warnings above');
		} else {
			console.log('❌ VALIDATION FAILED - Review errors above');
		}

		console.log('='.repeat(70));
	} catch (error) {
		console.error('\n❌ Validation failed:', error);
		throw error;
	} finally {
		oldDb.close();
	}
}

// Run validation
validate()
	.then(() => {
		console.log('\n🎉 Validation completed!');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\n💥 Validation failed:', error);
		process.exit(1);
	});
