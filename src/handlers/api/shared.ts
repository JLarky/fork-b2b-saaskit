import { handleError } from '@propelauth/node';
import { Cause, Effect, Layer } from 'effect';

import { HttpRequest } from '../../services/HttpRequest';

export const toError = (error: unknown) =>
	error instanceof Error ? error : new Error(String(error));

export const requireNonEmptyString = (value: string | null | undefined, message: string) =>
	value ? Effect.succeed(value) : Effect.fail(new Error(message));

export const tryPromise = <A>(evaluate: () => Promise<A>) =>
	Effect.tryPromise({
		try: evaluate,
		catch: toError,
	});

export const trySync = <A>(evaluate: () => A) =>
	Effect.try({
		try: evaluate,
		catch: toError,
	});

export const toApiErrorResponse = (error: unknown) => {
	const handledError = handleError(error, {
		logError: true,
		returnDetailedErrorToUser: false,
	});

	return new Response(handledError.message, {
		status: handledError.status,
	});
};

export const withApiErrorResponse = <A, E, R>(program: Effect.Effect<A, E, R>) =>
	program.pipe(
		Effect.catchAllCause((cause) => Effect.succeed(toApiErrorResponse(Cause.squash(cause))))
	);

export const runApiHandler = <R>(
	program: Effect.Effect<Response, unknown, HttpRequest | R>,
	request: Request,
	liveLayer: Layer.Layer<R, unknown, never>
) =>
	Effect.runPromise(
		withApiErrorResponse(
			program.pipe(
				Effect.provide(liveLayer),
				Effect.provideService(HttpRequest, {
					request,
					resHeaders: new Headers(),
				})
			)
		)
	);
