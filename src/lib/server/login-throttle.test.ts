import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
	loginCooldownRemaining,
	recordFailedLogin,
	clearFailedLogins,
	describeCooldown,
	resetLoginThrottle
} from './login-throttle';

const EMAIL = 'member@example.com';
const IP = '203.0.113.7';

describe('login throttle', () => {
	beforeEach(() => {
		resetLoginThrottle();
	});

	it('allows the first few failures without a cooldown', () => {
		for (let i = 0; i < 5; i++) {
			expect(recordFailedLogin(EMAIL, IP)).toBe(0);
		}

		expect(loginCooldownRemaining(EMAIL, IP)).toBe(0);
	});

	it('starts a cooldown once the allowance is spent', () => {
		for (let i = 0; i < 5; i++) recordFailedLogin(EMAIL, IP);

		const owed = recordFailedLogin(EMAIL, IP);
		expect(owed).toBeGreaterThan(0);
		expect(loginCooldownRemaining(EMAIL, IP)).toBeGreaterThan(0);
	});

	it('lengthens the cooldown with each further failure', () => {
		for (let i = 0; i < 5; i++) recordFailedLogin(EMAIL, IP);

		const first = recordFailedLogin(EMAIL, IP);
		const second = recordFailedLogin(EMAIL, IP);
		const third = recordFailedLogin(EMAIL, IP);

		expect(second).toBeGreaterThan(first);
		expect(third).toBeGreaterThan(second);
	});

	it('caps the cooldown rather than growing without bound', () => {
		for (let i = 0; i < 40; i++) recordFailedLogin(EMAIL, IP);

		expect(recordFailedLogin(EMAIL, IP)).toBeLessThanOrEqual(30 * 60 * 1000);
	});

	it('forgets the tally after a successful login', () => {
		for (let i = 0; i < 8; i++) recordFailedLogin(EMAIL, IP);
		expect(loginCooldownRemaining(EMAIL, IP)).toBeGreaterThan(0);

		clearFailedLogins(EMAIL, IP);

		expect(loginCooldownRemaining(EMAIL, IP)).toBe(0);
	});

	it('does not let one address lock out the same account elsewhere', () => {
		for (let i = 0; i < 10; i++) recordFailedLogin(EMAIL, IP);

		expect(loginCooldownRemaining(EMAIL, IP)).toBeGreaterThan(0);
		expect(loginCooldownRemaining(EMAIL, '198.51.100.4')).toBe(0);
	});

	it('tracks each account separately from the same address', () => {
		for (let i = 0; i < 10; i++) recordFailedLogin(EMAIL, IP);

		expect(loginCooldownRemaining('someone-else@example.com', IP)).toBe(0);
	});

	it('treats an email as the same account regardless of case or padding', () => {
		for (let i = 0; i < 10; i++) recordFailedLogin(EMAIL, IP);

		expect(loginCooldownRemaining('  MEMBER@EXAMPLE.COM ', IP)).toBeGreaterThan(0);
	});

	describe('cooldown expiry', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('lets someone back in once the cooldown elapses', () => {
			for (let i = 0; i < 6; i++) recordFailedLogin(EMAIL, IP);
			expect(loginCooldownRemaining(EMAIL, IP)).toBeGreaterThan(0);

			vi.advanceTimersByTime(60 * 1000 + 1);

			expect(loginCooldownRemaining(EMAIL, IP)).toBe(0);
		});
	});

	describe('describeCooldown', () => {
		it('rounds up to whole minutes', () => {
			expect(describeCooldown(30_000)).toBe('a minute');
			expect(describeCooldown(60_000)).toBe('a minute');
			expect(describeCooldown(61_000)).toBe('2 minutes');
			expect(describeCooldown(15 * 60_000)).toBe('15 minutes');
		});
	});
});
