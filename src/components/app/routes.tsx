import type { QueryClient } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { Outlet, type RouteObject } from 'react-router-dom';

import { env } from '../../config';
import type { Helpers } from '../../lib/trpc/root';
import { AuthSync } from '../AuthSync';
import { FullPageSupport, SupportWidget } from '../fogbender/Support';
import { AuthProvider } from '../propelauth';
import { orpc } from '../trpc';
import { App } from './App';
import { CreatePrompt } from './CreatePrompt';
import { EditPrompt } from './EditPrompt';
import { AppNav } from './Nav';
import { Prompt } from './Prompt';
import { Prompts } from './Prompts';
import { Settings } from './Settings';
import { propelAuthAtom } from './store';

export const routes: RemixBrowserContext & RouteObject[] = [
	{
		path: '/prompts/:promptId',
		loader: async ({ params }) => {
			const promptId = params.promptId;
			if (promptId) {
				// pre-fetch in browser — warm the React Query cache
				if (routes.orpcUtils && routes.queryClient) {
					await routes.queryClient
						.prefetchQuery(routes.orpcUtils.prompts.getPrompt.queryOptions({ input: { promptId } }))
						.catch(() => {});
				}
			}
			return null;
		},
		Component() {
			return <Prompt />;
		},
	},
	{
		path: '/app',
		Component() {
			const key = useAtomValue(propelAuthAtom);
			return (
				<AuthProvider key={key} authUrl={env.PUBLIC_AUTH_URL}>
					<AuthSync />
					<AppNav />
					<Outlet />
					<SupportWidget kind="floatie" />
				</AuthProvider>
			);
		},
		children: [
			{
				index: true,
				Component() {
					return <App />;
				},
			},
			{
				path: '/app/prompts',
				loader: async ({ context }) => {
					// pre-fetch in SSR
					if (context?.helpers) {
						await context.helpers.queryClient.prefetchQuery(
							context.helpers.orpc.prompts.getPrompts.queryOptions({ input: {} })
						);
					}
					// pre-fetch in browser
					if (routes.orpcUtils && routes.queryClient) {
						await routes.queryClient
							.prefetchQuery(routes.orpcUtils.prompts.getPrompts.queryOptions({ input: {} }))
							.catch(() => {});
					}
					return null;
				},
				Component() {
					return <Prompts />;
				},
			},
			{
				path: '/app/prompts/:promptId',
				loader: async ({ context, params }) => {
					const promptId = params.promptId;
					if (promptId) {
						// pre-fetch in SSR
						if (context?.helpers) {
							await context.helpers.queryClient.prefetchQuery(
								context.helpers.orpc.prompts.getPrompt.queryOptions({ input: { promptId } })
							);
						}
						// pre-fetch in browser
						if (routes.orpcUtils && routes.queryClient) {
							await routes.queryClient
								.prefetchQuery(
									routes.orpcUtils.prompts.getPrompt.queryOptions({ input: { promptId } })
								)
								.catch(() => {});
						}
					}
					return null;
				},
				Component() {
					return <Prompt />;
				},
			},
			{
				path: '/app/prompts/:promptId/edit',
				Component() {
					return <EditPrompt />;
				},
			},
			{
				path: '/app/prompts/create',
				Component() {
					return <CreatePrompt />;
				},
			},
			{
				path: '/app/settings',
				Component() {
					return <Settings />;
				},
			},
			{
				path: '/app/support',
				Component() {
					return <FullPageSupport />;
				},
			},
		],
	},
];

// browser-only context: uses client-side oRPC utils
export type RemixBrowserContext = {
	orpcUtils?: typeof orpc;
	queryClient?: QueryClient;
};

// server only context: uses server-side helpers
export type RemixContext = {
	helpers: Helpers;
};

declare module 'react-router-dom' {
	interface LoaderFunctionArgs {
		context?: RemixContext;
	}

	interface ActionFunctionArgs {
		context?: RemixContext;
	}
}
