import { sqliteTable, integer, text, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================
// Users (formerly Person/people)
// ============================================
export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name', { length: 100 }).notNull(),
	nickname: text('nickname', { length: 100 }),
	email: text('email', { length: 255 }).unique().notNull(),
	phoneNumber: text('phone_number', { length: 20 }),
	passwordHash: text('password_hash', { length: 255 }).notNull(),
	mugshotUrl: text('mugshot_url', { length: 500 }),

	// Preferences
	emailNotifications: integer('email_notifications', { mode: 'boolean' }).default(true),
	smsNotifications: integer('sms_notifications', { mode: 'boolean' }).default(false),

	// Metadata
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
	deletedAt: integer('deleted_at', { mode: 'timestamp' })
});

// ============================================
// Groups (formerly GroupPlay/groupplay)
// ============================================
export const groups = sqliteTable('groups', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name', { length: 100 }).notNull(),
	slug: text('slug', { length: 100 }).notNull(), // URL-friendly (e.g., "bucknuts")
	description: text('description'),
	season: integer('season').notNull(), // e.g., 2024

	// Group settings
	homeTeam: text('home_team', { length: 100 }), // e.g., "OSU"
	pictureUrl: text('picture_url', { length: 500 }),
	prize: text('prize', { length: 100 }), // e.g., "Coffee"
	prizeImageUrl: text('prize_image_url', { length: 500 }),

	// Theme colors
	primaryColor: text('primary_color', { length: 7 }).default('#BB0000'), // Hex color (e.g., Scarlet)
	accentColor: text('accent_color', { length: 7 }).default('#666666'), // Hex color (e.g., Grey)

	// Admin
	ownerId: integer('owner_id')
		.notNull()
		.references(() => users.id),

	// Metadata
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
}, (table) => ({
	// Unique constraint on slug + season combination
	slugSeasonUnique: unique().on(table.slug, table.season)
}));

// ============================================
// Group Memberships
// ============================================
export const memberships = sqliteTable('memberships', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	groupId: integer('group_id')
		.notNull()
		.references(() => groups.id, { onDelete: 'cascade' }),

	// Per-season settings
	betting: integer('betting', { mode: 'boolean' }).default(false), // Betting coffee this season?
	role: text('role', { length: 20 }).default('member'), // 'admin', 'member'

	// Metadata
	joinedAt: integer('joined_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// ============================================
// Games
// ============================================
export const games = sqliteTable('games', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	homeTeam: text('home_team', { length: 100 }).notNull(),
	awayTeam: text('away_team', { length: 100 }).notNull(),
	gameTime: integer('game_time', { mode: 'timestamp' }).notNull(),
	season: integer('season').notNull(),

	// Scores (null until game finishes)
	homeScore: integer('home_score'),
	awayScore: integer('away_score'),

	// Status
	status: text('status', { length: 20 }).default('scheduled'), // scheduled, live, finished, canceled

	// Betting odds (structured)
	spreadHome: text('spread_home'), // Store as text to preserve decimal precision
	overUnder: text('over_under'),
	oddsSource: text('odds_source', { length: 100 }),
	oddsUpdatedAt: integer('odds_updated_at', { mode: 'timestamp' }),

	// Metadata
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// ============================================
// Group Games (which games are tracked by which groups)
// ============================================
export const groupGames = sqliteTable('group_games', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	groupId: integer('group_id')
		.notNull()
		.references(() => groups.id, { onDelete: 'cascade' }),
	gameId: integer('game_id')
		.notNull()
		.references(() => games.id, { onDelete: 'cascade' }),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// ============================================
// Predictions
// ============================================
export const predictions = sqliteTable('predictions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	gameId: integer('game_id')
		.notNull()
		.references(() => games.id, { onDelete: 'cascade' }),
	groupId: integer('group_id')
		.notNull()
		.references(() => groups.id, { onDelete: 'cascade' }),

	// Prediction
	homeScore: integer('home_score').notNull(),
	awayScore: integer('away_score').notNull(),

	// Calculated (updated when game finishes)
	delta: integer('delta'), // Total points off
	rank: integer('rank'), // Ranking in this game
	wonCoffee: integer('won_coffee', { mode: 'boolean' }).default(false),

	// Metadata
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// ============================================
// In-Game Score Updates
// ============================================
export const inGameScores = sqliteTable('in_game_scores', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	gameId: integer('game_id')
		.notNull()
		.references(() => games.id, { onDelete: 'cascade' }),
	userId: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	groupId: integer('group_id')
		.notNull()
		.references(() => groups.id, { onDelete: 'cascade' }),

	// Score update
	homeScore: integer('home_score').notNull(),
	awayScore: integer('away_score').notNull(),
	comment: text('comment', { length: 200 }),

	// When was this posted?
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// ============================================
// Cron Jobs (Scheduled Tasks)
// ============================================
export const cronJobs = sqliteTable('cron_jobs', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name', { length: 100 }).notNull(), // Display name
	jobType: text('job_type', { length: 50 }).notNull(), // 'game_reminders', 'prediction_reminders'
	schedule: text('schedule', { length: 50 }).notNull(), // Cron expression: '0 12 * * *'
	enabled: integer('enabled', { mode: 'boolean' }).default(true),

	// Job-specific configuration (JSON)
	config: text('config'), // Store any job-specific settings as JSON

	// Tracking
	lastRun: integer('last_run', { mode: 'timestamp' }),
	nextRun: integer('next_run', { mode: 'timestamp' }),
	lastStatus: text('last_status', { length: 20 }), // 'success', 'error'
	lastError: text('last_error'),

	// Metadata
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// ============================================
// Sessions (server-side login sessions)
// ============================================
export const sessions = sqliteTable('sessions', {
	id: integer('id').primaryKey({ autoIncrement: true }),

	// Only the SHA-256 of the token is stored. A database dump, a backup, or a
	// leaked copy of the file therefore contains nothing that can be replayed as
	// a login -- the usable half of the credential only ever lives in the cookie.
	tokenHash: text('token_hash', { length: 64 }).unique().notNull(),

	userId: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),

	// Slides forward on use, so anyone who visits during the season is never
	// signed out, while a session left untouched lapses on its own.
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),

	// Metadata
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	lastUsedAt: integer('last_used_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// Type exports for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * A user as carried on `locals.user` and handed to the browser.
 *
 * Deliberately without the password hash: `locals.user` is serialized into the
 * page payload by the layout load, so anything on it is public to whoever holds
 * the session. Code that needs the hash (only the login check) reads the row
 * from the database itself.
 */
export type SessionUser = Omit<User, 'passwordHash'>;

/**
 * The user columns safe to render for *other* members: identity only, no
 * contact details. Public pages serialize their load data into the page
 * payload, so anything selected here is readable by anyone who fetches the
 * HTML -- signed in or not. Reach for this instead of `user: users`.
 */
export const publicUserColumns = {
	id: users.id,
	name: users.name,
	nickname: users.nickname,
	mugshotUrl: users.mugshotUrl
};

/** A user as rendered for other members: the shape of `publicUserColumns`. */
export type PublicUser = Pick<User, 'id' | 'name' | 'nickname' | 'mugshotUrl'>;

/**
 * Adds the contact details and preferences on top of the public columns.
 *
 * Server-side use only: notification delivery, the admin console, and the
 * viewer's own session record. Never select this into data a page hands to the
 * browser for members other than the viewer.
 */
export const contactUserColumns = {
	...publicUserColumns,
	email: users.email,
	phoneNumber: users.phoneNumber,
	emailNotifications: users.emailNotifications,
	smsNotifications: users.smsNotifications,
	createdAt: users.createdAt,
	updatedAt: users.updatedAt,
	lastLoginAt: users.lastLoginAt,
	deletedAt: users.deletedAt
};

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;

export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;

export type Prediction = typeof predictions.$inferSelect;
export type NewPrediction = typeof predictions.$inferInsert;

export type InGameScore = typeof inGameScores.$inferSelect;
export type NewInGameScore = typeof inGameScores.$inferInsert;

export type CronJob = typeof cronJobs.$inferSelect;
export type NewCronJob = typeof cronJobs.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
