import { Context, Layer } from 'effect';
import Stripe from 'stripe';

import { getStripeConfig, openStripe } from '../lib/stripe';

export interface PaymentsClient {
	stripe: Stripe;
	priceId: string;
}

export class Payments extends Context.Tag('Payments')<Payments, PaymentsClient | null>() {}

export const PaymentsLive = Layer.succeed(
	Payments,
	(() => {
		const config = getStripeConfig();
		if (!config) {
			return null;
		}
		return {
			stripe: openStripe(config),
			priceId: config.priceId,
		};
	})()
);
