import { serialize } from 'cookie';
import { Effect } from 'effect';
import jwt from 'jsonwebtoken';

import { AUTH_COOKIE_NAME, HTTP_ONLY_AUTH_COOKIE_NAME } from '../constants';
import { Unauthorized } from '../errors';
import { Auth } from '../services/Auth';
import { HttpRequest } from '../services/HttpRequest';

export interface AuthSyncInput {
	isLoggedIn: boolean;
	accessToken?: string;
	orgId: string;
}

export const authSyncHandler = (input: AuthSyncInput) =>
	Effect.gen(function* () {
		const auth = yield* Auth;
		const { req, resHeaders } = yield* HttpRequest;

		const parsedCookies = Object.fromEntries(
			(req.headers.get('cookie') || '').split(';').flatMap((pair) => {
				const [key, ...rest] = pair.trim().split('=');
				return key ? [[key, rest.join('=')]] : [];
			})
		);

		const set = (key: string, value: string) => {
			resHeaders.append(
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
			if (parsedCookies[AUTH_COOKIE_NAME] || parsedCookies[HTTP_ONLY_AUTH_COOKIE_NAME]) {
				set(HTTP_ONLY_AUTH_COOKIE_NAME, '');
				set(AUTH_COOKIE_NAME, '');
			}
		};

		if (!input.isLoggedIn || !input.accessToken) {
			reset();
			return 'session cleared' as const;
		}

		const decodedJwt = jwt.decode(input.accessToken);
		if (!decodedJwt || typeof decodedJwt === 'string') {
			reset();
			return yield* Effect.fail(new Unauthorized({ message: 'Could not decode access token.' }));
		}

		const res = yield* Effect.tryPromise({
			try: () => auth.validateAccessTokenAndGetUser('Bearer ' + input.accessToken),
			catch: () => new Unauthorized({ message: 'Could not validate access token.' }),
		});

		const publicCookie = {
			userId: res.userId,
			orgId: input.orgId || '',
			exp: String(decodedJwt.exp),
		};
		const httpOnlyCookie = {
			accessToken: input.accessToken,
		};
		set(HTTP_ONLY_AUTH_COOKIE_NAME, '' + new URLSearchParams(httpOnlyCookie));
		set(AUTH_COOKIE_NAME, '' + new URLSearchParams(publicCookie));
		return 'everything went well' as const;
	});
