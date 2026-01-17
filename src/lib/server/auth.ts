import bcrypt from 'bcryptjs';
import { db } from '$lib/db';
import { users, type User } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';

const SESSION_COOKIE_NAME = 'session';

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
 * Create a user session (simplified - stores user ID in cookie)
 * In production, use a proper session store
 */
export function createSession(userId: number): string {
	// In production, create a session token and store in Redis/DB
	// For now, we'll just encode the user ID (NOT SECURE for production)
	return Buffer.from(JSON.stringify({ userId, createdAt: Date.now() })).toString('base64');
}

/**
 * Get user from session token
 */
export async function getUserFromSession(sessionToken: string): Promise<User | null> {
	try {
		const decoded = JSON.parse(Buffer.from(sessionToken, 'base64').toString());
		const userId = decoded.userId;

		const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

		if (!user) return null;

		return user;
	} catch {
		return null;
	}
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
		maxAge: 60 * 60 * 24 * 30 // 30 days
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
