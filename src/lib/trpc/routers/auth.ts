import { ORPCError } from '@orpc/server';
import { serialize } from 'cookie';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { AUTH_COOKIE_NAME, HTTP_ONLY_AUTH_COOKIE_NAME } from '../../../constants';
import { propelauth } from '../../propelauth';
import { apiProcedure } from '../trpc';

export const authRouter = {
	authSync: apiProcedure
		.input(
			z.object({
				isLoggedIn: z.boolean(),
				accessToken: z.string().optional(),
				orgId: z.string(),
			})
		)
		.handler(async ({ context, input }) => {
			const currentCookies = context.parsedCookies;
			const set = (key: string, value: string) => {
				context.resHeaders.append(
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
				throw new ORPCError('UNAUTHORIZED', {
					message: 'Could not decode access token.',
				});
			}

			const res = await propelauth
				.validateAccessTokenAndGetUser('Bearer ' + input.accessToken)
				.then((user) => ({ kind: 'ok' as const, user }))
				.catch((error) => ({ kind: 'error' as const, error }));
			if (res.kind === 'error') {
				reset();
				throw new ORPCError('UNAUTHORIZED', {
					message: 'Could not validate access token.',
					cause: res.error,
				});
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
		}),
};
