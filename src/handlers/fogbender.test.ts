import { Effect, Exit, Layer } from 'effect';
import { describe, expect, it } from 'vitest';

import type { AuthClient } from '../services/Auth';
import { Auth } from '../services/Auth';
import { HttpRequest } from '../services/HttpRequest';
import { fogbenderHandler } from './fogbender';

const TEST_SECRET = 'test-fogbender-secret';

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

function runHandler(
	authImpl: Partial<AuthClient> = {},
	requestOpts: { authorization?: string; body?: unknown } = {}
) {
	return fogbenderHandler(TEST_SECRET).pipe(
		Effect.provide(
			Layer.mergeAll(
				makeAuthLayer(authImpl),
				makeRequestLayer('http://localhost:3000/api/fogbender', requestOpts)
			)
		)
	);
}

describe('fogbenderHandler', () => {
	it('returns a signed JWT on valid token + org', async () => {
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
		expect(result.userId).toBe('u1');
		expect(result.customerId).toBe('org-1');
		expect(typeof result.userJWT).toBe('string');
		expect(result.userJWT.split('.')).toHaveLength(3);
	});

	it('fails with Unauthorized when no Authorization header', async () => {
		const exit = await Effect.runPromiseExit(runHandler({}, { body: { orgId: 'org-1' } }));
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			const error = exit.cause.toString();
			expect(error).toContain('Unauthorized');
			expect(error).toContain('No token');
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
			expect(error).toContain('No orgId');
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
