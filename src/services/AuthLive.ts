import { Layer } from 'effect';

import { propelauth } from '../lib/propelauth';
import { Auth } from './Auth';

/** Backed by the shared `propelauth` singleton from `src/lib/propelauth.ts`. */
export const AuthLive = Layer.succeed(Auth, {
	validateAccessTokenAndGetUser: (token) => propelauth.validateAccessTokenAndGetUser(token),
	validateAccessTokenAndGetUserWithOrgInfo: (token, orgInfo) =>
		propelauth.validateAccessTokenAndGetUserWithOrgInfo(token, orgInfo),
	fetchBatchUserMetadataByUserIds: (userIds, includeOrgs) =>
		propelauth.fetchBatchUserMetadataByUserIds(userIds, includeOrgs),
});
