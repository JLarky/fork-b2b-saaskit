import { Context, Layer } from 'effect';

import { trackEvent } from '../lib/posthog';

export interface AnalyticsClient {
	readonly trackEvent: typeof trackEvent;
}

const liveAnalytics: AnalyticsClient = {
	trackEvent,
};

export class Analytics extends Context.Tag('Analytics')<Analytics, AnalyticsClient>() {}

export const AnalyticsLive = Layer.succeed(Analytics, liveAnalytics);

export const AnalyticsTest = (analytics: AnalyticsClient) => Layer.succeed(Analytics, analytics);
