import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import { db } from '$lib/db';
import { publicUserColumns, sessions, users, type SessionUser } from '$lib/db/schema';
import { and, eq, lt, ne } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';

const SESSION_COOKIE_NAME = 'session';

/**
 * How long a session survives without being used. The clock slides forward on
 * every visit, so an active member is never signed out; only a session nobody
 * has touched for this long lapses. There is deliberately no absolute cap --
 * revoking a session (logout, or a password change) is the way one ends early.
 */
const SESSION_IDLE_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Don't rewrite the row on every single request. Sliding the expiry at most
 * once an hour keeps an active session alive without a write per page view.
 */
const SESSION_SLIDE_AFTER_MS = 60 * 60 * 1000;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 10);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

/**
 * Hash a session token for storage and lookup.
 *
 * SHA-256 rather than bcrypt on purpose: the token is 256 bits of CSPRNG output,
 * so there is no low-entropy secret to slow an attacker down over, and this runs
 * on every request.
 */
function hashSessionToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/**
 * Create a session for a user and return the token to hand to the browser.
 *
 * The returned token is the only copy -- the database stores just its hash, so
 * it cannot be recovered afterwards.
 */
export async function createSession(userId: number): Promise<string> {
	const token = randomBytes(32).toString('base64url');
	const now = new Date();

	await db.insert(sessions).values({
		tokenHash: hashSessionToken(token),
		userId,
		expiresAt: new Date(now.getTime() + SESSION_IDLE_MS),
		createdAt: now,
		lastUsedAt: now
	});

	// Logging in is a natural moment to take out the rubbish, and it keeps the
	// table from accumulating lapsed rows without needing a scheduled job.
	await deleteExpiredSessions();

	return token;
}

/**
 * Look up the user for a session token, sliding its expiry forward.
 *
 * Returns null for an unknown, revoked, or lapsed token. An expired row is
 * removed as it's encountered.
 */
export async function getUserFromSession(sessionToken: string): Promise<SessionUser | null> {
	const [row] = await db
		.select({ session: sessions, user: publicUserColumns })
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.tokenHash, hashSessionToken(sessionToken)))
		.limit(1);

	if (!row) return null;

	const now = new Date();

	if (row.session.expiresAt <= now) {
		await db.delete(sessions).where(eq(sessions.id, row.session.id));
		return null;
	}

	if (now.getTime() - row.session.lastUsedAt.getTime() >= SESSION_SLIDE_AFTER_MS) {
		await db
			.update(sessions)
			.set({ lastUsedAt: now, expiresAt: new Date(now.getTime() + SESSION_IDLE_MS) })
			.where(eq(sessions.id, row.session.id));
	}

	return row.user;
}

/**
 * Revoke a single session -- what logout does.
 */
export async function deleteSession(sessionToken: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(sessionToken)));
}

/**
 * Revoke every session belonging to a user.
 *
 * Pass `exceptToken` to keep the caller's own session alive, which is what a
 * "sign out my other devices" action wants.
 */
export async function deleteUserSessions(userId: number, exceptToken?: string): Promise<void> {
	await db
		.delete(sessions)
		.where(
			exceptToken
				? and(eq(sessions.userId, userId), ne(sessions.tokenHash, hashSessionToken(exceptToken)))
				: eq(sessions.userId, userId)
		);
}

/**
 * Drop sessions that have lapsed.
 */
export async function deleteExpiredSessions(): Promise<void> {
	await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/**
 * Set session cookie
 */
export function setSessionCookie(event: RequestEvent, sessionToken: string) {
	event.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		secure: process.env.NODE_ENV === 'production',
		maxAge: SESSION_IDLE_MS / 1000
	});
}

/**
 * Delete session cookie
 */
export function deleteSessionCookie(event: RequestEvent) {
	event.cookies.delete(SESSION_COOKIE_NAME, {
		path: '/'
	});
}

/**
 * Get session token from cookies
 */
export function getSessionToken(event: RequestEvent): string | undefined {
	return event.cookies.get(SESSION_COOKIE_NAME);
}
