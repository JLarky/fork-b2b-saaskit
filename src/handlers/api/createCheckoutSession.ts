import { Effect } from 'effect';

import { Auth } from '../../services/Auth';
import { HttpRequest } from '../../services/HttpRequest';
import { Payments } from '../../services/Payments';
import { requireNonEmptyString } from './shared';

type CheckoutSessionRequestBody = {
	orgId?: string;
};

const readCheckoutSessionRequest = (request: Request) =>
	Effect.tryPromise(() => request.json() as Promise<CheckoutSessionRequestBody>);

export const createCheckoutSessionHandler = Effect.gen(function* () {
	const auth = yield* Auth;
	const payments = yield* Payments;
	const { request } = yield* HttpRequest;

	if (!payments) {
		yield* Effect.fail(new Error('Stripe secret key and price ID are not configured'));
	}

	const token = yield* requireNonEmptyString(request.headers.get('Authorization'), 'No token');
	const { orgId } = yield* readCheckoutSessionRequest(request);
	const requiredOrgId = yield* requireNonEmptyString(orgId, 'No orgId');

	yield* Effect.tryPromise(() =>
		auth.validateAccessTokenAndGetUserWithOrgInfo(token, { orgId: requiredOrgId })
	);

	const appUrl = new URL('/app/settings', request.url).toString();
	const session = yield* Effect.tryPromise(() =>
		payments.stripe.checkout.sessions.create({
			client_reference_id: requiredOrgId,
			line_items: [
				{
					price: payments.priceId,
					quantity: 1,
				},
			],
			subscription_data: {
				metadata: {
					what: 'subscription_data',
					orgId: requiredOrgId,
				},
			},
			metadata: {
				what: 'checkout_session',
				orgId: requiredOrgId,
			},
			mode: 'subscription',
			success_url: appUrl,
			cancel_url: appUrl,
		})
	);

	const url = yield* requireNonEmptyString(session.url, 'No checkout URL');

	return new Response(JSON.stringify({ url }));
});
