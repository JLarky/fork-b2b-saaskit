import { OrgMemberInfo } from '@propelauth/node';
import { describe, expect, it } from 'vitest';

import { fakeUser, mockValidateAccessTokenAndGetUser } from '../trpc/routers/test-utils';
import { authenticateMcpRequest } from './auth';

const apiToken = {
	token: 'service-token',
	userId: 'service-user',
	orgId: 'service-org',
};

describe('MCP auth', () => {
	it('rejects a request with no credential', async () => {
		const request = new Request('http://localhost:3000/mcp', { method: 'POST' });
		await expect(authenticateMcpRequest(request, {})).rejects.toMatchObject({ status: 401 });
	});

	it('accepts the API token as one user and organization', async () => {
		const request = new Request('http://localhost:3000/mcp', {
			method: 'POST',
			headers: { authorization: 'Bearer service-token' },
		});
		const ctx = await authenticateMcpRequest(request, apiToken);
		expect(ctx.user?.userId).toBe('service-user');
		expect(ctx.orgId).toBe('service-org');
		expect(mockValidateAccessTokenAndGetUser).not.toHaveBeenCalled();
	});

	it('refuses to let the API token select a different organization', async () => {
		const request = new Request('http://localhost:3000/mcp', {
			method: 'POST',
			headers: { authorization: 'Bearer service-token', 'x-org-id': 'other-org' },
		});
		await expect(authenticateMcpRequest(request, apiToken)).rejects.toMatchObject({ status: 403 });
	});

	it('uses the sole organization for a PropelAuth access token', async () => {
		const user = fakeUser({ userId: 'user-1', orgId: 'org-1' });
		mockValidateAccessTokenAndGetUser.mockResolvedValue(user);
		const request = new Request('http://localhost:3000/mcp', {
			method: 'POST',
			headers: { authorization: 'Bearer access-token' },
		});
		const ctx = await authenticateMcpRequest(request, {});
		expect(ctx.orgId).toBe('org-1');
		expect(ctx.user?.userId).toBe('user-1');
	});

	it('requires X-Org-Id when the user belongs to several organizations', async () => {
		const user = fakeUser({ userId: 'user-1', orgId: 'org-1' });
		user.orgIdToOrgMemberInfo = {
			'org-1':
				user.orgIdToOrgMemberInfo?.['org-1'] ??
				new OrgMemberInfo('org-1', 'A', {}, 'a', 'Owner', ['Owner'], []),
			'org-2': new OrgMemberInfo('org-2', 'B', {}, 'b', 'Member', ['Member'], []),
		};
		mockValidateAccessTokenAndGetUser.mockResolvedValue(user);
		const request = new Request('http://localhost:3000/mcp', {
			method: 'POST',
			headers: { authorization: 'Bearer access-token' },
		});
		await expect(authenticateMcpRequest(request, {})).rejects.toMatchObject({ status: 400 });

		const chosen = new Request('http://localhost:3000/mcp', {
			method: 'POST',
			headers: { authorization: 'Bearer access-token', 'x-org-id': 'org-2' },
		});
		await expect(authenticateMcpRequest(chosen, {})).resolves.toMatchObject({ orgId: 'org-2' });
	});

	it('accepts the app auth cookies', async () => {
		const user = fakeUser({ userId: 'cookie-user', orgId: 'cookie-org' });
		mockValidateAccessTokenAndGetUser.mockResolvedValue(user);
		const httpOnly = new URLSearchParams({ accessToken: 'from-cookie' }).toString();
		const pub = new URLSearchParams({ userId: user.userId, orgId: 'cookie-org' }).toString();
		const request = new Request('http://localhost:3000/mcp', {
			method: 'POST',
			headers: { cookie: `b2b_auth=${httpOnly}; js_b2b_auth=${pub}` },
		});
		const ctx = await authenticateMcpRequest(request, {});
		expect(ctx.user?.userId).toBe('cookie-user');
		expect(ctx.orgId).toBe('cookie-org');
		expect(mockValidateAccessTokenAndGetUser).toHaveBeenCalledWith('Bearer from-cookie');
	});
});
