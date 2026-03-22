import { Effect, Exit, Layer } from 'effect';
import { describe, expect, it } from 'vitest';

import type { AuthClient } from '../services/Auth';
import { Auth } from '../services/Auth';
import { HttpRequest } from '../services/HttpRequest';
import { Payments, type PaymentsClient } from '../services/Payments';
import { checkoutHandler } from './checkout';

function makeAuthLayer(impl: Partial<AuthClient> = {}) {
	return Layer.succeed(Auth, {
		validateAccessTokenAndGetUser: async () => {
			throw new Error('not implemented');
		},
		validateAccessTokenAndGetUserWithOrgInfo: async () => {
			throw new Error('not implemented');
		},
		fetchBatchUserMetadataByUserIds: async () => ({}),
		...impl,
	} as unknown as AuthClient);
}

function makeRequestLayer(url: string, opts: { authorization?: string; body?: unknown } = {}) {
	const headers = new Headers();
	if (opts.authorization) headers.set('Authorization', opts.authorization);
	return Layer.succeed(HttpRequest, {
		req: new Request(url, {
			method: 'POST',
			headers,
			body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
		}),
		resHeaders: new Headers(),
	});
}

const mockStripe = {
	checkout: {
		sessions: {
			create: async () => ({ url: 'https://checkout.stripe.com/session/test' }),
		},
	},
} as unknown as PaymentsClient['stripe'];

const TestPaymentsEnabled = Layer.succeed(Payments, {
	stripe: mockStripe,
	priceId: 'price_test_123',
});
const TestPaymentsDisabled = Layer.succeed(Payments, null);

function runHandler(
	authImpl: Partial<AuthClient> = {},
	requestOpts: { authorization?: string; body?: unknown } = {},
	paymentsLayer = TestPaymentsEnabled
) {
	return checkoutHandler.pipe(
		Effect.provide(
			Layer.mergeAll(
				makeAuthLayer(authImpl),
				makeRequestLayer('http://localhost:3000/api/create-checkout-session', requestOpts),
				paymentsLayer
			)
		)
	);
}

describe('checkoutHandler', () => {
	it('returns a checkout URL on valid token + org + Stripe', async () => {
		const result = await Effect.runPromise(
			runHandler(
				{
					validateAccessTokenAndGetUserWithOrgInfo: async () =>
						({
							user: { userId: 'u1' },
							orgMemberInfo: { orgId: 'org-1' },
						}) as never,
				},
				{ authorization: 'Bearer valid-token', body: { orgId: 'org-1' } }
			)
		);
		expect(result.url).toBe('https://checkout.stripe.com/session/test');
	});

	it('fails with NotFound when Payments is null', async () => {
		const exit = await Effect.runPromiseExit(
			runHandler(
				{},
				{ authorization: 'Bearer tok', body: { orgId: 'org-1' } },
				TestPaymentsDisabled
			)
		);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			const error = exit.cause.toString();
			expect(error).toContain('NotFound');
			expect(error).toContain('Stripe');
		}
	});

	it('fails with Unauthorized when no Authorization header', async () => {
		const exit = await Effect.runPromiseExit(runHandler({}, { body: { orgId: 'org-1' } }));
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			const error = exit.cause.toString();
			expect(error).toContain('Unauthorized');
		}
	});

	it('fails with Unauthorized when no orgId in body', async () => {
		const exit = await Effect.runPromiseExit(
			runHandler({}, { authorization: 'Bearer tok', body: {} })
		);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			const error = exit.cause.toString();
			expect(error).toContain('Unauthorized');
		}
	});

	it('fails with Forbidden when token validation fails', async () => {
		const exit = await Effect.runPromiseExit(
			runHandler(
				{
					validateAccessTokenAndGetUserWithOrgInfo: async () => {
						throw new Error('invalid token');
					},
				},
				{ authorization: 'Bearer bad', body: { orgId: 'org-1' } }
			)
		);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			const error = exit.cause.toString();
			expect(error).toContain('Forbidden');
		}
	});
});
