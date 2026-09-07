import { describe, it, expect, vi } from 'vitest';

/** Rows handed to db.insert().values(), so tests can inspect what got persisted. */
const insertedRows: any[] = [];

// Mock the database module before importing auth
vi.mock('$lib/db', () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(() => ({
			values: vi.fn(async (row: any) => {
				insertedRows.push(row);
			})
		})),
		update: vi.fn(),
		delete: vi.fn(() => ({ where: vi.fn(async () => undefined) }))
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
		it('should return an opaque token, not the user id', async () => {
			const token = await createSession(123);

			expect(typeof token).toBe('string');
			// The whole point of the change: the token must not be a readable claim
			// about who you are. Decoding it should not yield a userId.
			let decoded: unknown;
			try {
				decoded = JSON.parse(Buffer.from(token, 'base64').toString());
			} catch {
				decoded = null;
			}
			expect(decoded).not.toMatchObject({ userId: 123 });
			expect(token).not.toContain('123');
		});

		it('should carry enough entropy to be unguessable', async () => {
			const token = await createSession(1);

			// 32 random bytes as base64url
			expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
		});

		it('should never issue the same token twice', async () => {
			const issued = new Set<string>();
			for (let i = 0; i < 50; i++) {
				issued.add(await createSession(1));
			}

			expect(issued.size).toBe(50);
		});

		it('should store only a hash of the token', async () => {
			insertedRows.length = 0;
			const token = await createSession(7);

			expect(insertedRows).toHaveLength(1);
			const stored = insertedRows[0];
			expect(stored.userId).toBe(7);
			expect(stored.tokenHash).not.toBe(token);
			expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
			// The plaintext token must not appear anywhere in the persisted row.
			expect(JSON.stringify(stored)).not.toContain(token);
		});

		it('should set the expiry 90 days out', async () => {
			insertedRows.length = 0;
			const before = Date.now();
			await createSession(1);

			const ninetyDays = 90 * 24 * 60 * 60 * 1000;
			const expiresAt = insertedRows[0].expiresAt.getTime();
			expect(expiresAt).toBeGreaterThanOrEqual(before + ninetyDays - 5000);
			expect(expiresAt).toBeLessThanOrEqual(Date.now() + ninetyDays + 5000);
		});
	});
});
