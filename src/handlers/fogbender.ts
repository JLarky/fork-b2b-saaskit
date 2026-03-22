import { Effect } from 'effect';
import jsonwebtoken from 'jsonwebtoken';

import { Forbidden, Unauthorized } from '../errors';
import { Auth } from '../services/Auth';
import { HttpRequest } from '../services/HttpRequest';
import type { FogbenderTokenResponse } from '../types/types';

export const fogbenderHandler = (fogbenderSecret: string) =>
	Effect.gen(function* () {
		const auth = yield* Auth;
		const { req } = yield* HttpRequest;

		const token = req.headers.get('Authorization');
		if (!token) {
			return yield* Effect.fail(new Unauthorized({ message: 'No token' }));
		}

		const body = yield* Effect.tryPromise({
			try: () => req.json() as Promise<{ orgId?: string }>,
			catch: () => new Unauthorized({ message: 'Invalid request body' }),
		});
		if (!body.orgId) {
			return yield* Effect.fail(new Unauthorized({ message: 'No orgId' }));
		}

		const { user, orgMemberInfo } = yield* Effect.tryPromise({
			try: () => auth.validateAccessTokenAndGetUserWithOrgInfo(token, { orgId: body.orgId }),
			catch: () => new Forbidden({ message: 'Access denied' }),
		});

		const unsignedToken = {
			userId: user.userId,
			customerId: orgMemberInfo.orgId,
		};

		const userJWT = jsonwebtoken.sign(unsignedToken, fogbenderSecret, {
			algorithm: 'HS256',
		});

		return { ...unsignedToken, userJWT } satisfies FogbenderTokenResponse;
	});
