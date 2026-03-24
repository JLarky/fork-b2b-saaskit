import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod';
import type { APIRoute } from 'astro';

import { appRouter } from '../../lib/trpc/root';

export const prerender = false;

const generator = new OpenAPIGenerator({
	schemaConverters: [new ZodToJsonSchemaConverter()],
});

export const GET: APIRoute = async () => {
	const spec = await generator.generate(appRouter, {
		info: {
			title: 'Prompts with Friends API',
			version: '1.0.0',
			description: 'OpenAPI spec auto-generated from oRPC router definitions.',
		},
	});

	return new Response(JSON.stringify(spec, null, 2), {
		headers: {
			'content-type': 'application/json',
			'cache-control': 'public, max-age=60',
		},
	});
};
