import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { RouterClient } from '@orpc/server';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import { type DehydratedState, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { AppRouter } from '../lib/trpc/root';
import { QueryProvider } from './client';

const rpcLink = new RPCLink({
	url: '/api/trpc',
	headers: () => ({
		authorization: 'getAuthCookie()',
	}),
});

type Client = RouterClient<AppRouter>;
const client = createORPCClient<Client>(rpcLink);

// oxlint-disable-next-line react/only-export-components
export const orpc = createTanstackQueryUtils(client);

/**
 * @deprecated Use `orpc` instead of `trpc`. Kept for backward compat during migration.
 */
// oxlint-disable-next-line react/only-export-components
export const trpc = orpc;

export function TRPCProvider({
	children,
	dehydratedState,
}: {
	children: React.ReactNode;
	dehydratedState?: DehydratedState;
}) {
	const [queryClient] = useState(() => new QueryClient());
	return (
		<QueryProvider queryClient={queryClient}>
			<HydrationBoundary state={dehydratedState}>{children}</HydrationBoundary>
		</QueryProvider>
	);
}

/** Infer the output type of a router client procedure call. */
export type RouterOutput = {
	[K in keyof Client]: {
		[P in keyof Client[K]]: Client[K][P] extends (...args: any[]) => Promise<infer R> ? R : never;
	};
};
