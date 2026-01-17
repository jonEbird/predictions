import { describe, it, expect, vi } from 'vitest';

// Mock the database module before importing auth
vi.mock('$lib/db', () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn()
	}
}));

import { hashPassword, verifyPassword, createSession } from './auth';

describe('Authentication', () => {
	describe('hashPassword', () => {
		it('should hash a password', async () => {
			const password = 'testPassword123';
			const hash = await hashPassword(password);

			expect(hash).toBeDefined();
			expect(hash).not.toBe(password);
			expect(hash.length).toBeGreaterThan(0);
		});

		it('should generate different hashes for the same password', async () => {
			const password = 'samePassword';
			const hash1 = await hashPassword(password);
			const hash2 = await hashPassword(password);

			expect(hash1).not.toBe(hash2);
		});
	});

	describe('verifyPassword', () => {
		it('should verify correct password', async () => {
			const password = 'correctPassword';
			const hash = await hashPassword(password);
			const isValid = await verifyPassword(password, hash);

			expect(isValid).toBe(true);
		});

		it('should reject incorrect password', async () => {
			const correctPassword = 'correctPassword';
			const wrongPassword = 'wrongPassword';
			const hash = await hashPassword(correctPassword);
			const isValid = await verifyPassword(wrongPassword, hash);

			expect(isValid).toBe(false);
		});
	});

	describe('createSession', () => {
		it('should create a session token', () => {
			const userId = 123;
			const token = createSession(userId);

			expect(token).toBeDefined();
			expect(typeof token).toBe('string');
			expect(token.length).toBeGreaterThan(0);
		});

		it('should encode user ID in session token', () => {
			const userId = 456;
			const token = createSession(userId);

			// Decode the token to verify it contains the user ID
			const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
			expect(decoded.userId).toBe(userId);
			expect(decoded.createdAt).toBeDefined();
		});

		it('should encode user ID and timestamp in session token', () => {
			const userId = 789;
			const token = createSession(userId);

			// Decode the token to verify it contains the user ID and timestamp
			const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
			expect(decoded.userId).toBe(userId);
			expect(decoded.createdAt).toBeDefined();
			expect(typeof decoded.createdAt).toBe('number');
			expect(decoded.createdAt).toBeLessThanOrEqual(Date.now());
		});
	});
});
