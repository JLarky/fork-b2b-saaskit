import { Context, Layer } from 'effect';
import type Stripe from 'stripe';

import { getStripeConfig, openStripe } from '../lib/stripe';

export type PaymentsClient = {
	readonly stripe: Stripe;
	readonly priceId: string;
} | null;

const livePayments: PaymentsClient = (() => {
	const stripeConfig = getStripeConfig();
	if (!stripeConfig) {
		return null;
	}

	return {
		stripe: openStripe(stripeConfig),
		priceId: stripeConfig.priceId,
	};
})();

export class Payments extends Context.Tag('Payments')<Payments, PaymentsClient>() {}

export const PaymentsLive = Layer.succeed(Payments, livePayments);

export const PaymentsTest = (payments: PaymentsClient) => Layer.succeed(Payments, payments);
