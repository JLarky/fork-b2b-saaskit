import { Effect } from 'effect';

import type { Forbidden, NotFound, RateLimited, Unauthorized } from '../errors';

type HandlerError = Unauthorized | Forbidden | NotFound | RateLimited;

const statusByTag: Record<HandlerError['_tag'], number> = {
	Unauthorized: 401,
	Forbidden: 403,
	NotFound: 404,
	RateLimited: 429,
};

export function catchHttpErrors<A, R>(
	effect: Effect.Effect<A, HandlerError, R>
): Effect.Effect<A | Response, never, R> {
	return effect.pipe(
		Effect.catchAll((e) =>
			Effect.succeed(new Response(e.message, { status: statusByTag[e._tag] ?? 500 }))
		)
	);
}
