import type { APIRoute } from 'astro';
import { Effect, Layer } from 'effect';

import { fogbenderHandler } from '../../handlers/fogbender';
import { catchHttpErrors } from '../../handlers/response';
import { AuthLive } from '../../services/Auth';
import { HttpRequest } from '../../services/HttpRequest';
import { serverEnv } from '../../t3-env';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	const secret = serverEnv.FOGBENDER_SECRET;
	if (!secret) {
		return new Response('FOGBENDER_SECRET was not configured', { status: 500 });
	}

	return Effect.runPromise(
		fogbenderHandler(secret).pipe(
			Effect.map((data) => new Response(JSON.stringify(data), { status: 200 })),
			catchHttpErrors,
			Effect.provide(
				Layer.mergeAll(
					AuthLive,
					Layer.succeed(HttpRequest, { req: request, resHeaders: new Headers() })
				)
			),
			Effect.catchAllDefect(() =>
				Effect.succeed(new Response('Internal Server Error', { status: 500 }))
			)
		)
	);
};
