import { RPCHandler } from '@orpc/server/fetch';
import type { APIRoute } from 'astro';

import { appRouter } from '../../../lib/trpc/root';

export const prerender = false;

const handler = new RPCHandler(appRouter);

export const ALL: APIRoute = async ({ request }) => {
	// resHeaders collects headers set by procedures (e.g., set-cookie from authSync)
	const resHeaders = new Headers();

	const { matched, response } = await handler.handle(request, {
		prefix: '/api/trpc',
		context: {
			req: request,
			resHeaders,
		},
	});

	if (matched && response) {
		// Merge procedure-set headers (like set-cookie) into the oRPC response
		resHeaders.forEach((value, key) => {
			response.headers.append(key, value);
		});
		return response;
	}

	return new Response('Not Found', { status: 404 });
};
