import { initBaseAuth } from '@propelauth/node';
import { Context, Layer } from 'effect';

import { serverEnv } from '../t3-env';

type BaseAuth = ReturnType<typeof initBaseAuth>;

export interface AuthClient {
	validateAccessTokenAndGetUser: BaseAuth['validateAccessTokenAndGetUser'];
	validateAccessTokenAndGetUserWithOrgInfo: BaseAuth['validateAccessTokenAndGetUserWithOrgInfo'];
	fetchBatchUserMetadataByUserIds: BaseAuth['fetchBatchUserMetadataByUserIds'];
}

export class Auth extends Context.Tag('Auth')<Auth, AuthClient>() {}

// Singleton-per-isolate: construct once, reuse across requests.
export const AuthLive = Layer.sync(Auth, () =>
	initBaseAuth({
		authUrl: serverEnv.PUBLIC_AUTH_URL,
		apiKey: serverEnv.PROPELAUTH_API_KEY,
		manualTokenVerificationMetadata: {
			verifierKey: serverEnv.PROPELAUTH_VERIFIER_KEY,
			issuer: serverEnv.PUBLIC_AUTH_URL,
		},
	})
);
