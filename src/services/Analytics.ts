import { Context, Effect, Layer } from 'effect';
import { PostHog } from 'posthog-node';

import { serverEnv } from '../t3-env';

export interface AnalyticsClient {
	trackEvent(
		distinctId: string,
		event: string,
		properties?: Record<string, unknown>
	): Effect.Effect<void>;
}

export class Analytics extends Context.Tag('Analytics')<Analytics, AnalyticsClient>() {}

// No-ops when PUBLIC_POSTHOG_KEY is unset, matching current behavior.
export const AnalyticsLive = Layer.sync(Analytics, () => {
	const posthogKey = serverEnv.PUBLIC_POSTHOG_KEY;
	if (!posthogKey) {
		return {
			trackEvent: () => Effect.void,
		};
	}
	return {
		trackEvent: (
			distinctId: string,
			event: string,
			properties?: Record<string, unknown>
		): Effect.Effect<void> =>
			Effect.promise(async () => {
				const client = new PostHog(posthogKey);
				client.capture({ distinctId, event, properties });
				await client.shutdownAsync();
			}),
	};
});
