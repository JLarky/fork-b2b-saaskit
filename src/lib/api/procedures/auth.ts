import { serialize } from 'cookie';
import { Effect } from 'effect';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { AUTH_COOKIE_NAME, HTTP_ONLY_AUTH_COOKIE_NAME } from '../../../constants';
import { propelauth } from '../../propelauth';
import { ApiCtx } from '../context';
import { BadRequest, Unauthorized } from '../errors';

const authSyncInput = z.object({
	isLoggedIn: z.boolean(),
	accessToken: z.string().optional(),
	orgId: z.string(),
});

export type AuthSyncInput = z.infer<typeof authSyncInput>;

export const authSync = (rawInput: unknown) =>
	Effect.gen(function* () {
		const parsed = authSyncInput.safeParse(rawInput);
		if (!parsed.success) {
			return yield* Effect.fail(
				new BadRequest({ message: 'Invalid input', zodError: parsed.error.flatten() })
			);
		}
		const input = parsed.data;
		const ctx = yield* ApiCtx;
		const currentCookies = ctx.parsedCookies;
		const set = (key: string, value: string) => {
			ctx.resHeaders.append(
				'set-cookie',
				serialize(key, value, {
					path: '/',
					httpOnly: !key.startsWith('js_'),
					secure: true,
					sameSite: 'strict',
					maxAge: 365 * 24 * 3600,
				})
			);
		};

		const reset = () => {
			if (currentCookies[AUTH_COOKIE_NAME] || currentCookies[HTTP_ONLY_AUTH_COOKIE_NAME]) {
				set(HTTP_ONLY_AUTH_COOKIE_NAME, '');
				set(AUTH_COOKIE_NAME, '');
			}
		};

		if (!input.isLoggedIn || !input.accessToken) {
			reset();
			return 'session cleared';
		}

		const decodedJwt = jwt.decode(input.accessToken);
		if (!decodedJwt || typeof decodedJwt === 'string') {
			reset();
			return yield* Effect.fail(
				new Unauthorized({ message: 'Could not decode access token.' })
			);
		}

		const res = yield* Effect.tryPromise({
			try: () =>
				propelauth
					.validateAccessTokenAndGetUser('Bearer ' + input.accessToken)
					.then((user) => ({ kind: 'ok' as const, user }))
					.catch((error) => ({ kind: 'error' as const, error })),
			catch: (error) => new Unauthorized({ message: 'Could not validate access token.', cause: error }),
		});

		if (res.kind === 'error') {
			reset();
			return yield* Effect.fail(
				new Unauthorized({ message: 'Could not validate access token.', cause: res.error })
			);
		}

		const publicCookie = {
			userId: res.user.userId,
			orgId: input.orgId || '',
			exp: String(decodedJwt.exp),
		};
		const httpOnlyCookie = {
			accessToken: input.accessToken,
		};
		set(HTTP_ONLY_AUTH_COOKIE_NAME, '' + new URLSearchParams(httpOnlyCookie));
		set(AUTH_COOKIE_NAME, '' + new URLSearchParams(publicCookie));
		return 'everything went well';
	});
