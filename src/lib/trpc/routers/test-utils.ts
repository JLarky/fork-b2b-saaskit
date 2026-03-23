import type { OrgMemberInfo, User } from '@propelauth/node';
import { vi } from 'vitest';

// Store mock functions so they're accessible after vi.mock hoisting
const validateAccessTokenAndGetUser = vi.fn();
const fetchBatchUserMetadataByUserIds = vi.fn().mockResolvedValue({});

// Mock propelauth before any router imports
// This prevents the real initBaseAuth from running (which requires valid env vars)
vi.mock('../../propelauth', () => ({
	propelauth: {
		validateAccessTokenAndGetUser,
		fetchBatchUserMetadataByUserIds,
	},
}));

// Mock posthog to avoid real analytics calls
vi.mock('../../posthog', () => ({
	trackEvent: vi.fn(),
}));

/** Build a fake PropelAuth User object */
export function fakeUser(overrides: Partial<User> & { userId: string; orgId?: string }): User {
	const orgId = overrides.orgId ?? 'test-org-id';
	const orgMemberInfo: OrgMemberInfo = {
		orgId,
		orgName: 'Test Org',
		orgMetadata: {},
		urlSafeOrgName: 'test-org',
		userAssignedRole: 'Owner',
		userInheritedRolesPlusCurrentRole: ['Owner', 'Admin', 'Member'],
		userPermissions: [],
		hasPermission: () => true,
		isRole: () => true,
		isAtLeastRole: () => true,
	};

	return {
		userId: overrides.userId,
		email: overrides.email ?? `${overrides.userId}@test.com`,
		username: overrides.username ?? overrides.userId,
		firstName: overrides.firstName ?? 'Test',
		lastName: overrides.lastName ?? 'User',
		orgIdToOrgMemberInfo: { [orgId]: orgMemberInfo },
		loginMethod: { loginMethod: 'unknown' },
		mfaEnabled: false,
		canCreateOrgs: false,
		createdAt: Date.now() / 1000,
		lastActiveAt: Date.now() / 1000,
		updatePassword: false,
		...(overrides as Partial<User>),
	} as User;
}

/**
 * Build a fake Request + Headers that satisfies apiProcedure middleware.
 * The cookies encode a fake access token and org id so that
 * authProcedure / orgProcedure can extract them.
 */
export function fakeAuthContext(user: User, orgId: string) {
	const accessToken = 'fake-access-token';
	const httpOnlyCookie = new URLSearchParams({ accessToken }).toString();
	const publicCookie = new URLSearchParams({
		userId: user.userId,
		orgId,
	}).toString();

	const cookieHeader = `b2b_auth=${httpOnlyCookie}; js_b2b_auth=${publicCookie}`;

	// Set up propelauth mock to resolve this user for the fake token
	validateAccessTokenAndGetUser.mockResolvedValue(user);

	return {
		req: new Request('http://localhost:3000/api/trpc', {
			headers: { cookie: cookieHeader },
		}),
		resHeaders: new Headers(),
	};
}
