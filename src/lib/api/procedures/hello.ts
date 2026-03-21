import { Effect } from 'effect';

import { ApiCtx } from '../context';
import { InternalError } from '../errors';

let i = 0;

export const hello = Effect.gen(function* () {
	const ctx = yield* ApiCtx;
	const res = yield* Effect.tryPromise({
		try: () => ctx.userPromise(),
		catch: () => new InternalError({ message: 'Failed to validate user' }),
	});
	if (res.kind === 'ok') {
		return `Oh, so cool, you are already signed in! ${res.user.userId}`;
	}
	return 'Something from the server';
});

export const getCount = Effect.succeed(i).pipe(Effect.map(() => i));

export const increment = Effect.sync(() => ++i);
