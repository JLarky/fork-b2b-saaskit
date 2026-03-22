import { Effect } from 'effect';
import jsonwebtoken from 'jsonwebtoken';

import { Auth } from '../../services/Auth';
import { HttpRequest } from '../../services/HttpRequest';
import { serverEnv } from '../../t3-env';
import type { FogbenderTokenResponse } from '../../types/types';
import { requireNonEmptyString, tryPromise, trySync } from './shared';

type FogbenderRequestBody = {
	orgId?: string;
};

export const fogbenderConfig = {
	getSecret: () => serverEnv.FOGBENDER_SECRET,
};

const readFogbenderRequest = (request: Request) =>
	tryPromise(() => request.json() as Promise<FogbenderRequestBody>);

export const fogbenderHandler = Effect.gen(function* () {
	const auth = yield* Auth;
	const { request } = yield* HttpRequest;

	const secret = yield* requireNonEmptyString(
		fogbenderConfig.getSecret(),
		'FOGBENDER_SECRET was not configured'
	);
	const token = yield* requireNonEmptyString(request.headers.get('Authorization'), 'No token');
	const { orgId } = yield* readFogbenderRequest(request);
	const requiredOrgId = yield* requireNonEmptyString(orgId, 'No orgId');

	const { user, orgMemberInfo } = yield* tryPromise(() =>
		auth.validateAccessTokenAndGetUserWithOrgInfo(token, { orgId: requiredOrgId })
	);

	const unsignedToken = {
		userId: user.userId,
		customerId: orgMemberInfo.orgId,
	};
	const userJWT = yield* trySync(() =>
		jsonwebtoken.sign(unsignedToken, secret, {
			algorithm: 'HS256',
		})
	);

	const responseData: FogbenderTokenResponse = {
		...unsignedToken,
		userJWT,
	};

	return new Response(JSON.stringify(responseData), { status: 200 });
});
