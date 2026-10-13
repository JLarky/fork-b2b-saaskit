import { timingSafeEqual } from 'node:crypto';

import { OrgMemberInfo, type User } from '@propelauth/node';
import { parse } from 'cookie';

import { AUTH_COOKIE_NAME, HTTP_ONLY_AUTH_COOKIE_NAME } from '../../constants';
import { serverEnv } from '../../t3-env';
import type { ActionContext } from '../actions/define-action';
import { propelauth } from '../propelauth';

export class McpAuthError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = 'McpAuthError';
		this.status = status;
	}
}

export type McpApiTokenConfig = {
	token?: string;
	userId?: string;
	orgId?: string;
};

export function readMcpApiTokenConfig(): McpApiTokenConfig {
	return {
		token: serverEnv.MCP_API_TOKEN,
		userId: serverEnv.MCP_API_USER_ID,
		orgId: serverEnv.MCP_API_ORG_ID,
	};
}

/**
 * Authenticate an MCP request as a user in an organization.
 *
 * Primary path: the same PropelAuth access token the app already uses, sent as
 * `Authorization: Bearer` or via the existing auth cookies.
 *
 * Fallback: `MCP_API_TOKEN` acts as one configured user and organization.
 * Full MCP OAuth (protected-resource metadata and dynamic client registration)
 * is a follow-up.
 */
export async function authenticateMcpRequest(
	request: Request,
	apiToken: McpApiTokenConfig = readMcpApiTokenConfig()
): Promise<ActionContext> {
	const header = request.headers.get('authorization') ?? '';
	const bearer = /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, '').trim() : '';
	const cookies = readAuthCookies(request);
	const token = bearer || cookies.accessToken;
	if (!token) {
		throw new McpAuthError(
			401,
			'Send Authorization: Bearer with a PropelAuth access token, or the configured MCP API token.'
		);
	}

	const origin = new URL(request.url).origin;
	if (apiToken.token && tokensMatch(token, apiToken.token)) {
		return serviceContext(apiToken, request, origin);
	}

	let user: User;
	try {
		user = await propelauth.validateAccessTokenAndGetUser('Bearer ' + token);
	} catch {
		throw new McpAuthError(401, 'Could not validate access token.');
	}
	if (!user?.userId) {
		throw new McpAuthError(401, 'Could not validate access token.');
	}

	const requestedOrgId = request.headers.get('x-org-id')?.trim() || cookies.orgId;
	return {
		user,
		orgId: resolveOrgId(user, requestedOrgId),
		origin,
	};
}

function serviceContext(
	apiToken: McpApiTokenConfig,
	request: Request,
	origin: string
): ActionContext {
	if (!apiToken.userId || !apiToken.orgId) {
		throw new McpAuthError(500, 'MCP_API_TOKEN is set without MCP_API_USER_ID and MCP_API_ORG_ID.');
	}
	const requestedOrgId = request.headers.get('x-org-id')?.trim();
	if (requestedOrgId && requestedOrgId !== apiToken.orgId) {
		throw new McpAuthError(403, `This API token is limited to organization ${apiToken.orgId}.`);
	}
	return {
		user: serviceUser(apiToken.userId, apiToken.orgId),
		orgId: apiToken.orgId,
		origin,
	};
}

function serviceUser(userId: string, orgId: string): User {
	const orgMemberInfo = new OrgMemberInfo(
		orgId,
		'API token org',
		{},
		'api-token-org',
		'Owner',
		['Owner', 'Admin', 'Member'],
		[]
	);
	return {
		userId,
		email: `${userId}@mcp.local`,
		orgIdToOrgMemberInfo: { [orgId]: orgMemberInfo },
	} as User;
}

function resolveOrgId(user: User, requestedOrgId: string | undefined): string {
	const orgIds = Object.values(user.orgIdToOrgMemberInfo ?? {})
		.map((member) => member.orgId)
		.filter((orgId): orgId is string => Boolean(orgId));
	if (requestedOrgId) {
		if (!orgIds.includes(requestedOrgId)) {
			throw new McpAuthError(403, `No access to organization ${requestedOrgId}.`);
		}
		return requestedOrgId;
	}
	if (orgIds.length === 1) {
		const only = orgIds[0];
		if (only) return only;
	}
	if (orgIds.length === 0) {
		throw new McpAuthError(403, 'This account is not a member of an organization.');
	}
	throw new McpAuthError(
		400,
		`Choose an organization with the X-Org-Id header. Memberships: ${orgIds.join(', ')}.`
	);
}

function readAuthCookies(request: Request): { accessToken?: string; orgId?: string } {
	const cookies = parse(request.headers.get('cookie') || '');
	const httpOnly = cookies[HTTP_ONLY_AUTH_COOKIE_NAME];
	const pub = cookies[AUTH_COOKIE_NAME];
	if (!httpOnly || !pub) return {};
	const accessToken = new URLSearchParams(httpOnly).get('accessToken') || undefined;
	const orgId = new URLSearchParams(pub).get('orgId') || undefined;
	if (!accessToken) return {};
	return { accessToken, orgId };
}

function tokensMatch(received: string, expected: string): boolean {
	const left = Buffer.from(received);
	const right = Buffer.from(expected);
	if (left.length !== right.length) return false;
	return timingSafeEqual(left, right);
}
