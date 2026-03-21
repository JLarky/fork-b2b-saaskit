import { handleError } from '@propelauth/node';
import type { APIRoute } from 'astro';
import { Effect, Layer } from 'effect';

import { Auth } from '../../services/Auth';
import { AuthLive } from '../../services/AuthLive';
import { HttpRequest } from '../../services/HttpRequest';
import { Payments, PaymentsLive } from '../../services/Payments';

export const prerender = false;

const checkoutHandler = Effect.gen(function* () {
	const auth = yield* Auth;
	const payments = yield* Payments;
	const { req } = yield* HttpRequest;

	if (!payments) {
		return yield* Effect.fail(new Error('Stripe secret key and price ID are not configured'));
	}

	const token = req.headers.get('Authorization');
	if (!token) {
		return yield* Effect.fail(new Error('No token'));
	}

	const { orgId } = yield* Effect.tryPromise({
		try: () => req.json() as Promise<{ orgId?: string }>,
		catch: () => new Error('Invalid JSON body'),
	});

	if (!orgId) {
		return yield* Effect.fail(new Error('No orgId'));
	}

	yield* Effect.tryPromise({
		try: () => auth.validateAccessTokenAndGetUserWithOrgInfo(token, { orgId }),
		catch: (e) => e as Error,
	});

	const appUrl = new URL('/app/settings', req.url).toString();

	const session = yield* Effect.tryPromise({
		try: () =>
			payments.stripe.checkout.sessions.create({
				client_reference_id: orgId,
				line_items: [
					{
						price: payments.priceId,
						quantity: 1,
					},
				],
				subscription_data: {
					metadata: {
						what: 'subscription_data',
						orgId,
					},
				},
				metadata: {
					what: 'checkout_session',
					orgId,
				},
				mode: 'subscription',
				success_url: appUrl,
				cancel_url: appUrl,
			}),
		catch: (e) => e as Error,
	});

	const { url } = session;

	if (!url) {
		return yield* Effect.fail(new Error('No checkout URL'));
	}

	return new Response(JSON.stringify({ url }));
}).pipe(
	Effect.catchAll((e) =>
		Effect.sync(() => {
			const err = handleError(e, { logError: true, returnDetailedErrorToUser: false });
			return new Response(err.message, { status: err.status });
		})
	)
);

export const POST: APIRoute = async ({ request }) => {
	return Effect.runPromise(
		checkoutHandler.pipe(
			Effect.provide(
				Layer.mergeAll(
					AuthLive,
					PaymentsLive,
					Layer.succeed(HttpRequest, { req: request, resHeaders: new Headers() })
				)
			)
		)
	);
};
