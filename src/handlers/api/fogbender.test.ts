import { ForbiddenException, OrgMemberInfo, type User } from '@propelauth/node';
import { Effect } from 'effect';
import jsonwebtoken from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type AuthClient, AuthTest } from '../../services/Auth';
import { HttpRequestTest } from '../../services/HttpRequest';
import { fogbenderConfig, fogbenderHandler } from './fogbender';
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

const runFogbender = (request: Request, auth: AuthClient) =>
	Effect.runPromise(
		withApiErrorResponse(
			fogbenderHandler.pipe(
				Effect.provide(AuthTest(auth)),
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

describe('fogbenderHandler', () => {
	it('returns a signed Fogbender token for an authorized org member', async () => {
		vi.spyOn(fogbenderConfig, 'getSecret').mockReturnValue('test-secret');

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

		const response = await runFogbender(
			new Request('https://example.com/api/fogbender', {
				method: 'POST',
				headers: {
					Authorization: 'Bearer token',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ orgId: 'org-123' }),
			}),
			auth
		);

		expect(response.status).toBe(200);
		const payload = (await response.json()) as {
			userId: string;
			customerId: string;
			userJWT: string;
		};
		expect(payload.userId).toBe('user-123');
		expect(payload.customerId).toBe('org-123');
		expect(jsonwebtoken.verify(payload.userJWT, 'test-secret')).toMatchObject({
			userId: 'user-123',
			customerId: 'org-123',
		});
	});

	it('returns the existing unauthorized contract when the auth header is missing', async () => {
		vi.spyOn(fogbenderConfig, 'getSecret').mockReturnValue('test-secret');

		const response = await runFogbender(
			new Request('https://example.com/api/fogbender', {
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
			}))
		);

		expect(response.status).toBe(401);
		expect(await response.text()).toBe('Unauthorized');
	});

	it('returns the existing unauthorized contract for invalid request JSON', async () => {
		vi.spyOn(fogbenderConfig, 'getSecret').mockReturnValue('test-secret');

		const response = await runFogbender(
			new Request('https://example.com/api/fogbender', {
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
			}))
		);

		expect(response.status).toBe(401);
		expect(await response.text()).toBe('Unauthorized');
	});

	it('returns the existing unauthorized contract when orgId is missing', async () => {
		vi.spyOn(fogbenderConfig, 'getSecret').mockReturnValue('test-secret');

		const response = await runFogbender(
			new Request('https://example.com/api/fogbender', {
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
			}))
		);

		expect(response.status).toBe(401);
		expect(await response.text()).toBe('Unauthorized');
	});

	it('returns forbidden when PropelAuth rejects org access', async () => {
		vi.spyOn(fogbenderConfig, 'getSecret').mockReturnValue('test-secret');

		const response = await runFogbender(
			new Request('https://example.com/api/fogbender', {
				method: 'POST',
				headers: {
					Authorization: 'Bearer token',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ orgId: 'org-999' }),
			}),
			createAuth(async () => {
				throw new ForbiddenException('No access to org');
			})
		);

		expect(response.status).toBe(403);
		expect(await response.text()).toBe('Forbidden');
	});

	it('returns the existing unauthorized contract when Fogbender is not configured', async () => {
		vi.spyOn(fogbenderConfig, 'getSecret').mockReturnValue(undefined);

		const response = await runFogbender(
			new Request('https://example.com/api/fogbender', {
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
			}))
		);

		expect(response.status).toBe(401);
		expect(await response.text()).toBe('Unauthorized');
	});
});
