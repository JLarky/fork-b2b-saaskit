import type { initBaseAuth } from '@propelauth/node';
import { Context } from 'effect';

type BaseAuth = ReturnType<typeof initBaseAuth>;

/** Methods the app uses from PropelAuth (narrower than the full `initBaseAuth` client). */
export type AuthClient = Pick<
	BaseAuth,
	| 'validateAccessTokenAndGetUser'
	| 'validateAccessTokenAndGetUserWithOrgInfo'
	| 'fetchBatchUserMetadataByUserIds'
>;

export class Auth extends Context.Tag('Auth')<Auth, AuthClient>() {}
