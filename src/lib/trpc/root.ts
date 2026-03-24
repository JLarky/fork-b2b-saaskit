import { createRouterClient } from '@orpc/server';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import { dehydrate, QueryClient } from '@tanstack/react-query';
import type { AstroGlobal } from 'astro';

import { authRouter } from './routers/auth';
import { helloRouter } from './routers/hello';
import { promptsRouter } from './routers/prompts';
import { settingsRouter } from './routers/settings';
import { surveysRouter } from './routers/surveys';
import type { CreateContextOptions } from './trpc';

/**
 * The primary router — a plain object composing all sub-routers.
 */
export const appRouter = {
	hello: helloRouter,
	auth: authRouter,
	prompts: promptsRouter,
	settings: settingsRouter,
	surveys: surveysRouter,
};

export type AppRouter = typeof appRouter;

/**
 * Direct server-side caller (replaces tRPC's createCaller).
 * Use this for direct procedure invocation in tests and Astro SSR pages.
 */
export const createCaller = (ctx: CreateContextOptions) =>
	createRouterClient(appRouter, { context: ctx });

/**
 * Server-side helpers for SSR prefetching + dehydration.
 * Creates a QueryClient with oRPC TanStack Query utils for prefetching,
 * then dehydrate() serializes the cache for client hydration.
 */
export function createHelpers(Astro: AstroGlobal) {
	const ctx: CreateContextOptions = {
		req: Astro.request,
		resHeaders: Astro.response.headers,
	};
	return createServerSideHelpers(ctx);
}

export function createServerSideHelpers(ctx: CreateContextOptions) {
	const client = createRouterClient(appRouter, { context: ctx });
	const queryClient = new QueryClient();
	const orpc = createTanstackQueryUtils(client);

	return {
		client,
		orpc,
		queryClient,
		dehydrate: () => dehydrate(queryClient),
	};
}

export type Helpers = ReturnType<typeof createHelpers>;
