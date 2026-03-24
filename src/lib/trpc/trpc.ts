/**
 * oRPC server setup: context, middleware, and procedure bases.
 *
 * Migrated from tRPC. The middleware chain is:
 *   publicProcedure → apiProcedure → authProcedure → orgProcedure
 */

import { ORPCError, os } from '@orpc/server';
import type { User } from '@propelauth/node';
import { parse } from 'cookie';
import { unthunk } from 'unthunk';
import { z } from 'zod';

import { AUTH_COOKIE_NAME, HTTP_ONLY_AUTH_COOKIE_NAME } from '../../constants';
import { propelauth } from '../propelauth';

// ---------------------------------------------------------------------------
// 1. CONTEXT
// ---------------------------------------------------------------------------

type CreateAstroContextOptions = Partial<{
	req: Request;
	resHeaders: Headers;
}>;

export type CreateContextOptions = CreateAstroContextOptions;

// ---------------------------------------------------------------------------
// 2. CONTEXT TYPES used by middleware layers
// ---------------------------------------------------------------------------

export type ApiContext = {
	req: Request;
	resHeaders: Headers;
	parsedCookies: Record<string, string>;
	accessToken: string | undefined;
	userOrgId: string | undefined;
	userPromise: Promise<{ kind: 'ok'; user: User } | { kind: 'error'; error: unknown }>;
};

export type AuthContext = ApiContext & { user: User };

export type OrgContext = AuthContext & { requiredOrgId: string };

// ---------------------------------------------------------------------------
// 3. PROCEDURE BASES
// ---------------------------------------------------------------------------

/** Public procedure — no auth required, no request required. */
export const publicProcedure = os.$context<CreateContextOptions>();

/**
 * API procedure — requires `req` and `resHeaders`.
 * Parses cookies, lazily extracts accessToken, orgId, and userPromise.
 */
const apiMiddleware = publicProcedure.middleware(async ({ context, next }) => {
	if (!context.req || !context.resHeaders) {
		throw new Error('You are missing `req` or `resHeaders` in your call.');
	}

	const req = context.req;
	const resHeaders = context.resHeaders;
	const newCtx = unthunk({
		req: () => req,
		resHeaders: () => resHeaders,
		parsedCookies: () => parse(req.headers.get('cookie') || ''),
		accessToken: () => {
			const { parsedCookies } = newCtx;
			if (parsedCookies[AUTH_COOKIE_NAME] && parsedCookies[HTTP_ONLY_AUTH_COOKIE_NAME]) {
				const httpOnlyCookie = new URLSearchParams(parsedCookies[HTTP_ONLY_AUTH_COOKIE_NAME]);
				return httpOnlyCookie.get('accessToken') || undefined;
			}
			return;
		},
		userOrgId: () => {
			const { parsedCookies } = newCtx;
			if (newCtx.accessToken) {
				const publicCookie = new URLSearchParams(parsedCookies[AUTH_COOKIE_NAME]);
				return publicCookie.get('orgId') || undefined;
			}
			return;
		},
		userPromise: async () => {
			return await propelauth
				.validateAccessTokenAndGetUser('Bearer ' + newCtx.accessToken)
				.then((user) => ({ kind: 'ok' as const, user }))
				.catch((error) => ({ kind: 'error' as const, error }));
		},
	});

	return next({ context: newCtx as unknown as ApiContext });
});

export const apiProcedure = publicProcedure.use(apiMiddleware);

/**
 * Auth procedure — requires valid user.
 */
const authMiddleware = os.$context<ApiContext>().middleware(async ({ context, next }) => {
	const user = await context.userPromise;
	if (user.kind === 'error') {
		throw new ORPCError('UNAUTHORIZED', {
			message: 'Could not validate access token.',
			cause: user.error,
		});
	}

	return next({ context: { user: user.user } as { user: User } });
});

export const authProcedure = apiProcedure.use(authMiddleware);

/**
 * Org procedure — requires user membership in an organization.
 * Accepts optional `orgId` in input to override the cookie org.
 */
export const orgProcedure = authProcedure.use(async ({ context, next }) => {
	// Try to extract orgId from input (if present), fall back to cookie-based org
	const requiredOrgId = context.userOrgId;
	if (requiredOrgId) {
		for (const oid in context.user.orgIdToOrgMemberInfo) {
			const orgMemberInfo = context.user.orgIdToOrgMemberInfo[oid];
			if (orgMemberInfo?.orgId === requiredOrgId) {
				return next({ context: { requiredOrgId } as { requiredOrgId: string } });
			}
		}
	}

	throw new ORPCError('FORBIDDEN', {
		message: `This route requires user access to the organization ${requiredOrgId}.`,
	});
});

/** Reusable orgId input field — add to orgProcedure-based schemas that accept orgId. */
export const orgIdInput = { orgId: z.string().optional() };
