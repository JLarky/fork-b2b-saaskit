import { initBaseAuth } from '@propelauth/node';
import { ENV } from 'varlock/env';

export const propelauth = initBaseAuth({
	authUrl: ENV.PUBLIC_AUTH_URL,
	apiKey: ENV.PROPELAUTH_API_KEY,
	manualTokenVerificationMetadata: {
		verifierKey: ENV.PROPELAUTH_VERIFIER_KEY,
		issuer: ENV.PUBLIC_AUTH_URL,
	},
});
