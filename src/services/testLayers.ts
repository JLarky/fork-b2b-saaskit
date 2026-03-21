import { Layer } from 'effect';

import type { AnalyticsClient } from './Analytics';
import { Analytics } from './Analytics';
import type { AuthClient } from './Auth';
import { Auth } from './Auth';
import type { PaymentsClient } from './Payments';
import { Payments } from './Payments';

export const TestAuth = (client: AuthClient) => Layer.succeed(Auth, client);

export const TestPayments = (client: PaymentsClient | null) => Layer.succeed(Payments, client);

export const TestAnalytics = (client: AnalyticsClient) => Layer.succeed(Analytics, client);
