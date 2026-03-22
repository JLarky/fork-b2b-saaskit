import { Effect } from 'effect';

import { Forbidden, NotFound, Unauthorized } from '../errors';
import { Auth } from '../services/Auth';
import { HttpRequest } from '../services/HttpRequest';
import { Payments } from '../services/Payments';

export const checkoutHandler = Effect.gen(function* () {
	const auth = yield* Auth;
	const { req } = yield* HttpRequest;
	const payments = yield* Payments;

	if (!payments) {
		return yield* Effect.fail(
			new NotFound({ message: 'Stripe secret key and price ID are not configured' })
		);
	}

	const token = req.headers.get('Authorization');
	if (!token) {
		return yield* Effect.fail(new Unauthorized({ message: 'No token' }));
	}

	const body = yield* Effect.tryPromise({
		try: () => req.json() as Promise<{ orgId?: string }>,
		catch: () => new Unauthorized({ message: 'Invalid request body' }),
	});
	if (!body.orgId) {
		return yield* Effect.fail(new Unauthorized({ message: 'No orgId' }));
	}

	yield* Effect.tryPromise({
		try: () => auth.validateAccessTokenAndGetUserWithOrgInfo(token, { orgId: body.orgId }),
		catch: () => new Forbidden({ message: 'Access denied' }),
	});

	const appUrl = new URL('/app/settings', req.url).toString();
	const session = yield* Effect.tryPromise({
		try: () =>
			payments.stripe.checkout.sessions.create({
				client_reference_id: body.orgId,
				line_items: [{ price: payments.priceId, quantity: 1 }],
				subscription_data: {
					metadata: { what: 'subscription_data', orgId: body.orgId! },
				},
				metadata: { what: 'checkout_session', orgId: body.orgId! },
				mode: 'subscription',
				success_url: appUrl,
				cancel_url: appUrl,
			}),
		catch: (e) => new NotFound({ message: e instanceof Error ? e.message : 'Checkout failed' }),
	});

	const { url } = session;
	if (!url) {
		return yield* Effect.fail(new NotFound({ message: 'No checkout URL' }));
	}

	return { url };
});
