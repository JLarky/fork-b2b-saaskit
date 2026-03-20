import type { PublicTypedEnvSchema } from 'varlock/env';
import { ENV } from 'varlock/env';

// Public, non-sensitive values — each `ENV.*` access is inlined for the client bundle by @varlock/astro-integration.
export const env: PublicTypedEnvSchema = {
	PUBLIC_AUTH_URL: ENV.PUBLIC_AUTH_URL,
	PUBLIC_FOGBENDER_WIDGET_ID: ENV.PUBLIC_FOGBENDER_WIDGET_ID,
	PUBLIC_POSTHOG_KEY: ENV.PUBLIC_POSTHOG_KEY,
	STRIPE_PRICE_ID: ENV.STRIPE_PRICE_ID,
};
