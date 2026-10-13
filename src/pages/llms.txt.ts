import type { APIRoute } from 'astro';

import { renderLlmsTxt } from '../lib/llms-txt';

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
	const body = renderLlmsTxt(new URL(request.url).origin);
	return new Response(body, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'public, max-age=60',
		},
	});
};
