import { Context, Layer } from 'effect';
import Stripe from 'stripe';

import { serverEnv } from '../t3-env';

export interface PaymentsClient {
	stripe: Stripe;
	priceId: string;
}

// null when Stripe is not configured (both keys must be present).
export class Payments extends Context.Tag('Payments')<Payments, PaymentsClient | null>() {}

// Singleton-per-isolate: construct once, reuse across requests.
export const PaymentsLive = Layer.sync(Payments, () => {
	const apiKey = serverEnv.STRIPE_SECRET_KEY;
	const priceId = serverEnv.STRIPE_PRICE_ID;
	if (!apiKey || !priceId) return null;
	return {
		stripe: new Stripe(apiKey, { apiVersion: '2022-11-15', typescript: true }),
		priceId,
	};
});
