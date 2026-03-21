import { parse } from 'cookie';
import { Effect, Layer } from 'effect';
import { z } from 'zod';

import { AUTH_COOKIE_NAME, HTTP_ONLY_AUTH_COOKIE_NAME } from '../../constants';
import { propelauth } from '../propelauth';
import { ApiCtx, AuthCtx, OrgCtx, RequestCtx } from './context';
import { Forbidden, Unauthorized } from './errors';

export const ApiLayer = Layer.effect(
	ApiCtx,
	Effect.gen(function* () {
		const { req, resHeaders } = yield* RequestCtx;
		const parsedCookies = parse(req.headers.get('cookie') || '');

		let accessToken: string | undefined;
		if (parsedCookies[AUTH_COOKIE_NAME] && parsedCookies[HTTP_ONLY_AUTH_COOKIE_NAME]) {
			const httpOnlyCookie = new URLSearchParams(parsedCookies[HTTP_ONLY_AUTH_COOKIE_NAME]);
			accessToken = httpOnlyCookie.get('accessToken') || undefined;
		}

		let userOrgId: string | undefined;
		if (accessToken) {
			const publicCookie = new URLSearchParams(parsedCookies[AUTH_COOKIE_NAME]);
			userOrgId = publicCookie.get('orgId') || undefined;
		}

		const userPromise = () =>
			propelauth
				.validateAccessTokenAndGetUser('Bearer ' + accessToken)
				.then((user) => ({ kind: 'ok' as const, user }))
				.catch((error) => ({ kind: 'error' as const, error }));

		return { req, resHeaders, parsedCookies, accessToken, userOrgId, userPromise };
	})
);

export const AuthLayer = Layer.effect(
	AuthCtx,
	Effect.gen(function* () {
		const ctx = yield* ApiCtx;
		const user = yield* Effect.tryPromise({
			try: () => ctx.userPromise(),
			catch: () => new Unauthorized({ message: 'Could not validate access token.' }),
		});
		if (user.kind === 'error') {
			return yield* Effect.fail(
				new Unauthorized({ message: 'Could not validate access token.', cause: user.error })
			);
		}
		return { user: user.user };
	})
);

export function orgLayer(rawInput?: { orgId?: string }) {
	return Layer.effect(
		OrgCtx,
		Effect.gen(function* () {
			const ctx = yield* ApiCtx;
			const { user } = yield* AuthCtx;
			const options = z.object({ orgId: z.string().optional() }).safeParse(rawInput);
			const requiredOrgId = (options.success && options.data.orgId) || ctx.userOrgId;
			if (requiredOrgId) {
				for (const orgId in user.orgIdToOrgMemberInfo) {
					const orgMemberInfo = user.orgIdToOrgMemberInfo[orgId];
					if (orgMemberInfo?.orgId === requiredOrgId) {
						return { requiredOrgId };
					}
				}
			}
			return yield* Effect.fail(
				new Forbidden({
					message: `This route requires user access to the organization ${requiredOrgId}.`,
				})
			);
		})
	);
}
