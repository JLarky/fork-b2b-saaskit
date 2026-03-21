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

const noopAnalytics: AnalyticsClient = {
	trackEvent: () => Effect.void,
};

export const AnalyticsLive = Layer.sync(Analytics, () => {
	const key = serverEnv.PUBLIC_POSTHOG_KEY;
	if (!key) {
		return noopAnalytics;
	}
	return {
		trackEvent: (distinctId, event, properties) =>
			Effect.tryPromise({
				try: async () => {
					const client = new PostHog(key);
					try {
						client.identify({
							distinctId,
							properties: {
								isDev: import.meta.env.DEV,
								...properties,
							},
						});
						client.capture({ distinctId, event });
					} finally {
						await client.shutdownAsync();
					}
				},
				catch: () => new Error('Analytics capture failed'),
			}).pipe(Effect.catchAll(() => Effect.void)),
	};
});
