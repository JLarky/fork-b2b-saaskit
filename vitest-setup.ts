import 'varlock/auto-load';

import { vi } from 'vitest';

import {
	mockFetchBatchUserMetadataByUserIds,
	mockValidateAccessTokenAndGetUser,
} from './src/lib/trpc/routers/test-utils';

// Mock propelauth globally — prevents real initBaseAuth from running
// and allows tests to control validateAccessTokenAndGetUser behavior
vi.mock('./src/lib/propelauth', () => ({
	propelauth: {
		validateAccessTokenAndGetUser: mockValidateAccessTokenAndGetUser,
		fetchBatchUserMetadataByUserIds: mockFetchBatchUserMetadataByUserIds,
	},
}));

// Mock posthog to avoid real analytics calls
vi.mock('./src/lib/posthog', () => ({
	trackEvent: vi.fn(),
}));
