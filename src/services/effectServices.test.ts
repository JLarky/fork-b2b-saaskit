import type { User } from '@propelauth/node';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import { Forbidden, RateLimited, Unauthorized } from '../errors';
import type { AuthClient } from './Auth';
import { Auth } from './Auth';
import { TestAuth } from './testLayers';

describe('typed errors', () => {
	it('constructs Unauthorized with _tag', () => {
		const e = new Unauthorized({ message: 'nope' });
		expect(e._tag).toBe('Unauthorized');
		expect(e.message).toBe('nope');
	});

	it('constructs Forbidden', () => {
		expect(new Forbidden({ message: 'x' })._tag).toBe('Forbidden');
	});

	it('constructs RateLimited with resetsAt', () => {
		const d = new Date('2025-01-01');
		const e = new RateLimited({ message: 'slow down', resetsAt: d });
		expect(e.resetsAt).toEqual(d);
	});
});

describe('Auth test layer', () => {
	it('injects a mock AuthClient', async () => {
		const mockAuth: AuthClient = {
			validateAccessTokenAndGetUser: async (): Promise<User> => ({
				userId: 'user-1',
				email: 'test@example.com',
				orgIdToOrgMemberInfo: {},
			}),
			validateAccessTokenAndGetUserWithOrgInfo: async () => {
				throw new Error('not used');
			},
			fetchBatchUserMetadataByUserIds: async () => ({}),
		};

		const program = Effect.gen(function* () {
			const auth = yield* Auth;
			return yield* Effect.tryPromise({
				try: () => auth.validateAccessTokenAndGetUser('Bearer tok'),
				catch: () => new Error('auth failed'),
			});
		});

		const user = await Effect.runPromise(program.pipe(Effect.provide(TestAuth(mockAuth))));
		expect(user.userId).toBe('user-1');
	});
});
