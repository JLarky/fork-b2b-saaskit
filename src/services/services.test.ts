import type { UserMetadata } from '@propelauth/node';
import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';

import { Analytics, type AnalyticsClient } from './Analytics';
import { Auth, type AuthClient } from './Auth';
import { Database } from './Database';
import { HttpRequest, type RequestContext } from './HttpRequest';
import { Payments, type PaymentsClient } from './Payments';

// ---------------------------------------------------------------------------
// Test layer factories
// ---------------------------------------------------------------------------

const TestAuth = Layer.succeed(Auth, {
	validateAccessTokenAndGetUser: async () => {
		throw new Error('not implemented in test');
	},
	validateAccessTokenAndGetUserWithOrgInfo: async () => {
		throw new Error('not implemented in test');
	},
	fetchBatchUserMetadataByUserIds: async () => ({}),
} as unknown as AuthClient);

function testAuthWithUsers(users: Record<string, UserMetadata>) {
	return Layer.succeed(Auth, {
		validateAccessTokenAndGetUser: async (header: string | undefined) => {
			const token = header?.replace('Bearer ', '') ?? '';
			const user = users[token];
			if (!user) throw new Error('invalid token');
			return user as never;
		},
		validateAccessTokenAndGetUserWithOrgInfo: async () => {
			throw new Error('not implemented in test');
		},
		fetchBatchUserMetadataByUserIds: async (ids: string[]) => {
			const result: Record<string, UserMetadata> = {};
			for (const id of ids) {
				if (users[id]) result[id] = users[id];
			}
			return result;
		},
	} as unknown as AuthClient);
}

function testAnalytics() {
	const events: { distinctId: string; event: string; properties?: Record<string, unknown> }[] = [];
	const layer = Layer.succeed(Analytics, {
		trackEvent: (
			distinctId: string,
			event: string,
			properties?: Record<string, unknown>
		): Effect.Effect<void> => {
			events.push({ distinctId, event, properties });
			return Effect.void;
		},
	} satisfies AnalyticsClient);
	return { layer, events };
}

const TestPaymentsDisabled = Layer.succeed(Payments, null);

function testPaymentsEnabled() {
	return Layer.succeed(Payments, {
		stripe: {} as PaymentsClient['stripe'],
		priceId: 'price_test_123',
	});
}

const TestHttpRequest = Layer.succeed(HttpRequest, {
	req: new Request('http://localhost:3000/test'),
	resHeaders: new Headers(),
} satisfies RequestContext);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Auth service', () => {
	it('resolves from test layer and calls fetchBatchUserMetadataByUserIds', async () => {
		const program = Effect.gen(function* () {
			const auth = yield* Auth;
			return yield* Effect.promise(() => auth.fetchBatchUserMetadataByUserIds(['u1']));
		});
		const result = await Effect.runPromise(program.pipe(Effect.provide(TestAuth)));
		expect(result).toEqual({});
	});

	it('validates tokens against a user map', async () => {
		const users = {
			token123: {
				userId: 'user-a',
				email: 'a@test.com',
				username: 'userA',
				firstName: 'A',
				lastName: 'Test',
			} as UserMetadata,
		};
		const program = Effect.gen(function* () {
			const auth = yield* Auth;
			return yield* Effect.promise(() => auth.fetchBatchUserMetadataByUserIds(['token123']));
		});
		const result = await Effect.runPromise(program.pipe(Effect.provide(testAuthWithUsers(users))));
		expect(result['token123']?.userId).toBe('user-a');
	});
});

describe('Analytics service', () => {
	it('records events via test layer', async () => {
		const { layer, events } = testAnalytics();
		const program = Effect.gen(function* () {
			const analytics = yield* Analytics;
			yield* analytics.trackEvent('user-1', 'test_event');
			yield* analytics.trackEvent('user-2', 'another_event', { page: '/home' });
		});
		await Effect.runPromise(program.pipe(Effect.provide(layer)));
		expect(events).toEqual([
			{ distinctId: 'user-1', event: 'test_event', properties: undefined },
			{ distinctId: 'user-2', event: 'another_event', properties: { page: '/home' } },
		]);
	});
});

describe('Payments service', () => {
	it('resolves to null when disabled', async () => {
		const program = Effect.gen(function* () {
			return yield* Payments;
		});
		const result = await Effect.runPromise(program.pipe(Effect.provide(TestPaymentsDisabled)));
		expect(result).toBeNull();
	});

	it('resolves to a client when enabled', async () => {
		const program = Effect.gen(function* () {
			const payments = yield* Payments;
			return payments?.priceId ?? null;
		});
		const result = await Effect.runPromise(program.pipe(Effect.provide(testPaymentsEnabled())));
		expect(result).toBe('price_test_123');
	});
});

describe('HttpRequest service', () => {
	it('provides request context', async () => {
		const program = Effect.gen(function* () {
			const { req, resHeaders } = yield* HttpRequest;
			return { url: req.url, headerCount: [...resHeaders].length };
		});
		const result = await Effect.runPromise(program.pipe(Effect.provide(TestHttpRequest)));
		expect(result.url).toBe('http://localhost:3000/test');
		expect(result.headerCount).toBe(0);
	});

	it('allows setting response headers', async () => {
		const resHeaders = new Headers();
		const layer = Layer.succeed(HttpRequest, {
			req: new Request('http://localhost:3000/api'),
			resHeaders,
		});
		const program = Effect.gen(function* () {
			const ctx = yield* HttpRequest;
			ctx.resHeaders.set('x-custom', 'value');
		});
		await Effect.runPromise(program.pipe(Effect.provide(layer)));
		expect(resHeaders.get('x-custom')).toBe('value');
	});
});

describe('service composition', () => {
	it('all services compose in a merged layer', async () => {
		const { layer: analyticsLayer, events } = testAnalytics();
		const combined = Layer.mergeAll(
			TestAuth,
			analyticsLayer,
			TestPaymentsDisabled,
			TestHttpRequest
		);
		const program = Effect.gen(function* () {
			const auth = yield* Auth;
			const analytics = yield* Analytics;
			const payments = yield* Payments;
			const { req } = yield* HttpRequest;
			yield* analytics.trackEvent('u1', 'composed');
			return {
				hasAuth: typeof auth.validateAccessTokenAndGetUser === 'function',
				paymentsNull: payments === null,
				requestUrl: req.url,
			};
		});
		const result = await Effect.runPromise(program.pipe(Effect.provide(combined)));
		expect(result).toEqual({
			hasAuth: true,
			paymentsNull: true,
			requestUrl: 'http://localhost:3000/test',
		});
		expect(events).toEqual([{ distinctId: 'u1', event: 'composed', properties: undefined }]);
	});

	it('Database tag is usable in an effect program', async () => {
		const mockDb = { query: { surveys: {} } };
		const TestDatabase = Layer.succeed(Database, mockDb as never);
		const program = Effect.gen(function* () {
			const db = yield* Database;
			return db !== null;
		});
		const result = await Effect.runPromise(program.pipe(Effect.provide(TestDatabase)));
		expect(result).toBe(true);
	});
});
