import type { User, UserAndOrgMemberInfo, UserMetadata } from '@propelauth/node';
import { Context, Effect, Layer } from 'effect';

export interface AuthClient {
	readonly validateAccessTokenAndGetUser: (authorizationHeader?: string) => Promise<User>;
	readonly validateAccessTokenAndGetUserWithOrgInfo: (
		authorizationHeader: string | undefined,
		requiredOrgInfo: { orgId?: string; orgName?: string }
	) => Promise<UserAndOrgMemberInfo>;
	readonly fetchBatchUserMetadataByUserIds: (
		userIds: string[],
		includeOrgs?: boolean
	) => Promise<Record<string, UserMetadata>>;
}

export class Auth extends Context.Tag('Auth')<Auth, AuthClient>() {}

export const AuthLive = Layer.effect(
	Auth,
	Effect.tryPromise(async () => {
		const { propelauth } = await import('../lib/propelauth');
		return propelauth;
	})
);

export const AuthTest = (auth: AuthClient) => Layer.succeed(Auth, auth);
