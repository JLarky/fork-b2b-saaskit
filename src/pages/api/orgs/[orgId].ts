import { handleError } from '@propelauth/node';
import type { APIRoute } from 'astro';

import { propelauth } from '../../../lib/propelauth';
import { publicUserInfo } from '../../../lib/publicUserInfo';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
	const token = request.headers.get('Authorization');
	try {
		if (!token) {
			throw new Error('No token');
		}

		const { orgId } = params;
		if (!orgId) {
			throw new Error('No orgId');
		}

		// check that we have access to this org
		await propelauth.validateAccessTokenAndGetUserWithOrgInfo(token, { orgId });
		// get users in org
		const orgUsers = await propelauth.fetchUsersInOrg({ orgId });

		const responseData = {
			users: orgUsers.users.map(publicUserInfo),
		};
		return new Response(JSON.stringify(responseData), { status: 200 });
	} catch (e) {
		const err = handleError(e, { logError: true, returnDetailedErrorToUser: false });
		return new Response(err.message, { status: err.status });
	}
};
