import cookie from 'js-cookie';
import { useEffect, useMemo } from 'react';

import { AUTH_COOKIE_NAME } from '../constants';
import { api } from './api';
import { parseJwt } from './jwt';
import { useActiveOrg, useAuthInfo } from './propelauth';

export function AuthSync() {
	const auth = useAuthInfo();
	const orgId = useActiveOrg()?.orgId || '';
	const authMutation = api.auth.authSync.useMutation();
	const params = useMemo(() => {
		if (auth.loading === false) {
			return {
				isLoggedIn: auth.isLoggedIn,
				accessToken: auth.accessToken || undefined,
				userId: auth.user?.userId,
				orgId,
			};
		}

		return { isLoggedIn: undefined, accessToken: undefined, userId: undefined };
	}, [auth, orgId]);

	useEffect(() => {
		if (params.isLoggedIn === false && cookie.get(AUTH_COOKIE_NAME)) {
			authMutation.mutate(params as never);
			return;
		}

		if (params.isLoggedIn) {
			const cookieValues = new URLSearchParams(cookie.get(AUTH_COOKIE_NAME) || '');
			const userIdFromCookie = cookieValues.get('userId');
			const orgIdFromCookie = cookieValues.get('orgId');
			const jwtValues = parseJwt(params.accessToken || '') as {
				exp: number;
			};
			if (params.userId !== userIdFromCookie || orgIdFromCookie !== orgId) {
				authMutation.mutate(params as never);
				return;
			}

			const expFromCookie = cookieValues.get('exp');
			const expFromCookieNumber = Number(expFromCookie) || 0;
			console.log('expFromCookieNumber', jwtValues.exp - expFromCookieNumber);
			if (jwtValues.exp - expFromCookieNumber > 5 * 60) {
				authMutation.mutate(params as never);
				return;
			}
		}
		// oxlint-disable-next-line react-hooks/exhaustive-deps
	}, [params.isLoggedIn, params.accessToken]);
	return null;
}
