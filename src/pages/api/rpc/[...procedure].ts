import type { APIRoute } from 'astro';

import { handleRpc } from '../../../lib/api/router';

export const prerender = false;

export const GET: APIRoute = async ({ request, params }) => {
	const procedure = params.procedure || '';
	const url = new URL(request.url);
	const inputParam = url.searchParams.get('input');
	let input: unknown;
	if (inputParam) {
		try {
			input = JSON.parse(inputParam);
		} catch {
			return new Response(
				JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Invalid input JSON' } }),
				{ status: 400, headers: { 'content-type': 'application/json' } }
			);
		}
	}
	const resHeaders = new Headers({ 'content-type': 'application/json' });
	return handleRpc(procedure, input, { req: request, resHeaders });
};

export const POST: APIRoute = async ({ request, params }) => {
	const procedure = params.procedure || '';
	let input: unknown;
	try {
		const body = await request.json();
		input = body;
	} catch {
		// no body is fine for some mutations
	}
	const resHeaders = new Headers({ 'content-type': 'application/json' });
	return handleRpc(procedure, input, { req: request, resHeaders });
};
