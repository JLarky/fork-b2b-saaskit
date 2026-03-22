import { ForbiddenException, OrgMemberInfo, type User } from '@propelauth/node';
import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type AuthClient, AuthTest } from '../../services/Auth';
import { HttpRequestTest } from '../../services/HttpRequest';
import { type PaymentsClient, PaymentsTest } from '../../services/Payments';
import { createCheckoutSessionHandler } from './createCheckoutSession';
import { withApiErrorResponse } from './shared';

const createUser = (userId = 'user-123'): User => ({
	userId,
	email: 'user@example.com',
});

const createAuth = (
	validateAccessTokenAndGetUserWithOrgInfo: AuthClient['validateAccessTokenAndGetUserWithOrgInfo']
): AuthClient => ({
	validateAccessTokenAndGetUser: async () => createUser(),
	validateAccessTokenAndGetUserWithOrgInfo,
	fetchBatchUserMetadataByUserIds: async () => ({}),
});

const createPayments = (options?: { url?: string | null }) => {
	const createSession = vi.fn().mockResolvedValue({
		url: options && 'url' in options ? options.url : 'https://stripe.test/checkout-session',
	});

	const payments: PaymentsClient = {
		stripe: {
			checkout: {
				sessions: {
					create: createSession,
				},
			},
		} as never,
		priceId: 'price_123',
	};

	return {
		createSession,
		payments,
	};
};

const runCheckoutSession = (request: Request, auth: AuthClient, payments: PaymentsClient) =>
	Effect.runPromise(
		withApiErrorResponse(
			createCheckoutSessionHandler.pipe(
				Effect.provide(AuthTest(auth)),
				Effect.provide(PaymentsTest(payments)),
				Effect.provide(
					HttpRequestTest({
						request,
						resHeaders: new Headers(),
					})
				)
			)
		)
	);

afterEach(() => {
	vi.restoreAllMocks();
});

describe('createCheckoutSessionHandler', () => {
	it('returns a checkout url and preserves the Stripe session payload', async () => {
		const { createSession, payments } = createPayments();
		const auth = createAuth(async (_token, requiredOrgInfo) => ({
			user: createUser(),
			orgMemberInfo: new OrgMemberInfo(
				requiredOrgInfo.orgId ?? 'org-123',
				'Acme',
				{},
				'acme',
				'Admin',
				['Admin'],
				[]
			),
		}));

		const response = await runCheckoutSession(
			new Request('https://example.com/api/create-checkout-session', {
				method: 'POST',
				headers: {
					Authorization: 'Bearer token',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ orgId: 'org-123' }),
			}),
			auth,
			payments
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			url: 'https://stripe.test/checkout-session',
		});
		expect(createSession).toHaveBeenCalledWith({
			client_reference_id: 'org-123',
			line_items: [
				{
					price: 'price_123',
					quantity: 1,
				},
			],
			subscription_data: {
				metadata: {
					what: 'subscription_data',
					orgId: 'org-123',
				},
			},
			metadata: {
				what: 'checkout_session',
				orgId: 'org-123',
			},
			mode: 'subscription',
			success_url: 'https://example.com/app/settings',
			cancel_url: 'https://example.com/app/settings',
		});
	});

	it('returns the existing unauthorized contract when the auth header is missing', async () => {
		const response = await runCheckoutSession(
			new Request('https://example.com/api/create-checkout-session', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ orgId: 'org-123' }),
			}),
			createAuth(async (_token, requiredOrgInfo) => ({
				user: createUser(),
				orgMemberInfo: new OrgMemberInfo(
					requiredOrgInfo.orgId ?? 'org-123',
					'Acme',
					{},
					'acme',
					'Admin',
					['Admin'],
					[]
				),
			})),
			createPayments().payments
		);

		expect(response.status).toBe(401);
		expect(await response.text()).toBe('Unauthorized');
	});

	it('returns the existing unauthorized contract when Stripe is not configured', async () => {
		const response = await runCheckoutSession(
			new Request('https://example.com/api/create-checkout-session', {
				method: 'POST',
				headers: {
					Authorization: 'Bearer token',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ orgId: 'org-123' }),
			}),
			createAuth(async (_token, requiredOrgInfo) => ({
				user: createUser(),
				orgMemberInfo: new OrgMemberInfo(
					requiredOrgInfo.orgId ?? 'org-123',
					'Acme',
					{},
					'acme',
					'Admin',
					['Admin'],
					[]
				),
			})),
			null
		);

		expect(response.status).toBe(401);
		expect(await response.text()).toBe('Unauthorized');
	});

	it('returns forbidden when PropelAuth rejects org access', async () => {
		const response = await runCheckoutSession(
			new Request('https://example.com/api/create-checkout-session', {
				method: 'POST',
				headers: {
					Authorization: 'Bearer token',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ orgId: 'org-999' }),
			}),
			createAuth(async () => {
				throw new ForbiddenException('No access to org');
			}),
			createPayments().payments
		);

		expect(response.status).toBe(403);
		expect(await response.text()).toBe('Forbidden');
	});

	it('returns the existing unauthorized contract for invalid request JSON', async () => {
		const response = await runCheckoutSession(
			new Request('https://example.com/api/create-checkout-session', {
				method: 'POST',
				headers: {
					Authorization: 'Bearer token',
					'Content-Type': 'application/json',
				},
				body: '{',
			}),
			createAuth(async () => ({
				user: createUser(),
				orgMemberInfo: new OrgMemberInfo('org-123', 'Acme', {}, 'acme', 'Admin', ['Admin'], []),
			})),
			createPayments().payments
		);

		expect(response.status).toBe(401);
		expect(await response.text()).toBe('Unauthorized');
	});

	it('returns the existing unauthorized contract when orgId is missing', async () => {
		const response = await runCheckoutSession(
			new Request('https://example.com/api/create-checkout-session', {
				method: 'POST',
				headers: {
					Authorization: 'Bearer token',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({}),
			}),
			createAuth(async () => ({
				user: createUser(),
				orgMemberInfo: new OrgMemberInfo('org-123', 'Acme', {}, 'acme', 'Admin', ['Admin'], []),
			})),
			createPayments().payments
		);

		expect(response.status).toBe(401);
		expect(await response.text()).toBe('Unauthorized');
	});

	it('returns the existing unauthorized contract when Stripe does not return a checkout url', async () => {
		const response = await runCheckoutSession(
			new Request('https://example.com/api/create-checkout-session', {
				method: 'POST',
				headers: {
					Authorization: 'Bearer token',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ orgId: 'org-123' }),
			}),
			createAuth(async (_token, requiredOrgInfo) => ({
				user: createUser(),
				orgMemberInfo: new OrgMemberInfo(
					requiredOrgInfo.orgId ?? 'org-123',
					'Acme',
					{},
					'acme',
					'Admin',
					['Admin'],
					[]
				),
			})),
			createPayments({ url: null }).payments
		);

		expect(response.status).toBe(401);
		expect(await response.text()).toBe('Unauthorized');
	});
});
