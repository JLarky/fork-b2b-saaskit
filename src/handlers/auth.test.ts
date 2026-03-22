import { Effect, Exit, Layer } from 'effect';
import jsonwebtoken from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { AUTH_COOKIE_NAME, HTTP_ONLY_AUTH_COOKIE_NAME } from '../constants';
import type { AuthClient } from '../services/Auth';
import { Auth } from '../services/Auth';
import { HttpRequest } from '../services/HttpRequest';
import { authSyncHandler } from './auth';

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

function makeRequestLayer(cookie = '') {
	const headers = new Headers();
	if (cookie) headers.set('cookie', cookie);
	const resHeaders = new Headers();
	return {
		layer: Layer.succeed(HttpRequest, {
			req: new Request('http://localhost:3000/api/trpc/auth.authSync', {
				method: 'POST',
				headers,
			}),
			resHeaders,
		}),
		resHeaders,
	};
}

const validJwt = jsonwebtoken.sign(
	{ userId: 'u1', exp: Math.floor(Date.now() / 1000) + 3600 },
	'test-secret'
);

function runHandler(
	input: { isLoggedIn: boolean; accessToken?: string; orgId: string },
	authImpl: Partial<AuthClient> = {},
	cookie = ''
) {
	const { layer, resHeaders } = makeRequestLayer(cookie);
	const effect = authSyncHandler(input).pipe(
		Effect.provide(Layer.mergeAll(makeAuthLayer(authImpl), layer))
	);
	return { effect, resHeaders };
}

describe('authSyncHandler', () => {
	it('returns "session cleared" when not logged in', async () => {
		const { effect } = runHandler({ isLoggedIn: false, orgId: '' });
		const result = await Effect.runPromise(effect);
		expect(result).toBe('session cleared');
	});

	it('sets auth cookies on valid token', async () => {
		const { effect, resHeaders } = runHandler(
			{ isLoggedIn: true, accessToken: validJwt, orgId: 'org-1' },
			{
				validateAccessTokenAndGetUser: async () => ({ userId: 'u1' }) as never,
			}
		);
		const result = await Effect.runPromise(effect);
		expect(result).toBe('everything went well');
		const cookies = resHeaders.getSetCookie();
		expect(cookies.length).toBeGreaterThanOrEqual(2);
		const cookieNames = cookies.map((c) => c.split('=')[0]);
		expect(cookieNames).toContain(AUTH_COOKIE_NAME);
		expect(cookieNames).toContain(HTTP_ONLY_AUTH_COOKIE_NAME);
	});

	it('resets cookies when access token cannot be decoded', async () => {
		const cookie = `${AUTH_COOKIE_NAME}=old; ${HTTP_ONLY_AUTH_COOKIE_NAME}=old`;
		const { effect, resHeaders } = runHandler(
			{ isLoggedIn: true, accessToken: 'not-a-jwt', orgId: '' },
			{},
			cookie
		);
		const exit = await Effect.runPromiseExit(effect);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			expect(exit.cause.toString()).toContain('Unauthorized');
		}
		const setCookies = resHeaders.getSetCookie();
		expect(setCookies.length).toBeGreaterThanOrEqual(2);
	});

	it('fails with Unauthorized when token validation fails', async () => {
		const { effect } = runHandler(
			{ isLoggedIn: true, accessToken: validJwt, orgId: '' },
			{
				validateAccessTokenAndGetUser: async () => {
					throw new Error('bad token');
				},
			}
		);
		const exit = await Effect.runPromiseExit(effect);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			expect(exit.cause.toString()).toContain('Unauthorized');
			expect(exit.cause.toString()).toContain('validate access token');
		}
	});
});
