import { Context, Layer } from 'effect';

import { propelauth } from '../lib/propelauth';

export interface AuthClient {
	readonly validateAccessTokenAndGetUser: typeof propelauth.validateAccessTokenAndGetUser;
	readonly validateAccessTokenAndGetUserWithOrgInfo: typeof propelauth.validateAccessTokenAndGetUserWithOrgInfo;
	readonly fetchBatchUserMetadataByUserIds: typeof propelauth.fetchBatchUserMetadataByUserIds;
}

const liveAuth: AuthClient = propelauth;

export class Auth extends Context.Tag('Auth')<Auth, AuthClient>() {}

export const AuthLive = Layer.succeed(Auth, liveAuth);

export const AuthTest = (auth: AuthClient) => Layer.succeed(Auth, auth);
