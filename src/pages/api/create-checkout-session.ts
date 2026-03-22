import type { APIRoute } from 'astro';
import { Effect, Layer } from 'effect';

import { checkoutHandler } from '../../handlers/checkout';
import { catchHttpErrors } from '../../handlers/response';
import { AuthLive } from '../../services/Auth';
import { HttpRequest } from '../../services/HttpRequest';
import { PaymentsLive } from '../../services/Payments';

export const prerender = false;

export const POST: APIRoute = async ({ request }) =>
	Effect.runPromise(
		checkoutHandler.pipe(
			Effect.map((data) => new Response(JSON.stringify(data))),
			catchHttpErrors,
			Effect.provide(
				Layer.mergeAll(
					AuthLive,
					PaymentsLive,
					Layer.succeed(HttpRequest, { req: request, resHeaders: new Headers() })
				)
			),
			Effect.catchAllDefect(() =>
				Effect.succeed(new Response('Internal Server Error', { status: 500 }))
			)
		)
	);
