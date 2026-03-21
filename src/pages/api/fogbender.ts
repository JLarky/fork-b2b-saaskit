import { handleError } from '@propelauth/node';
import type { APIRoute } from 'astro';
import { Effect, Layer } from 'effect';
import jsonwebtoken from 'jsonwebtoken';

import { Auth } from '../../services/Auth';
import { AuthLive } from '../../services/AuthLive';
import { HttpRequest } from '../../services/HttpRequest';
import { serverEnv } from '../../t3-env';
import type { FogbenderTokenResponse } from '../../types/types';

export const prerender = false;

const fogbenderHandler = Effect.gen(function* () {
	const auth = yield* Auth;
	const { req } = yield* HttpRequest;

	const secret = serverEnv.FOGBENDER_SECRET;
	if (!secret) {
		return yield* Effect.fail(new Error('FOGBENDER_SECRET was not configured'));
	}

	const token = req.headers.get('Authorization');
	if (!token) {
		return yield* Effect.fail(new Error('No token'));
	}

	const { orgId } = yield* Effect.tryPromise({
		try: () => req.json() as Promise<{ orgId?: string }>,
		catch: () => new Error('Invalid JSON body'),
	});

	if (!orgId) {
		return yield* Effect.fail(new Error('No orgId'));
	}

	const { user, orgMemberInfo } = yield* Effect.tryPromise({
		try: () => auth.validateAccessTokenAndGetUserWithOrgInfo(token, { orgId }),
		catch: (e) => e as Error,
	});

	const unsignedToken = {
		userId: user.userId,
		customerId: orgMemberInfo.orgId,
	};

	const userJWT = jsonwebtoken.sign(unsignedToken, secret, {
		algorithm: 'HS256',
	});

	const responseData: FogbenderTokenResponse = {
		...unsignedToken,
		userJWT,
	};

	return new Response(JSON.stringify(responseData), { status: 200 });
}).pipe(
	Effect.catchAll((e) =>
		Effect.sync(() => {
			const err = handleError(e, { logError: true, returnDetailedErrorToUser: false });
			return new Response(err.message, { status: err.status });
		})
	)
);

export const POST: APIRoute = async ({ request }) => {
	return Effect.runPromise(
		fogbenderHandler.pipe(
			Effect.provide(
				Layer.mergeAll(
					AuthLive,
					Layer.succeed(HttpRequest, { req: request, resHeaders: new Headers() })
				)
			)
		)
	);
};
