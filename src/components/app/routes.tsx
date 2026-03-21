import type { QueryClient } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { Outlet, type RouteObject } from 'react-router-dom';

import { env } from '../../config';
import type { Helpers } from '../../lib/api/router';
import type { ApiUtils } from '../api';
import { AuthSync } from '../AuthSync';
import { FullPageSupport, SupportWidget } from '../fogbender/Support';
import { AuthProvider } from '../propelauth';
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
				await routes.apiUtils?.prompts.getPrompt.ensureData({ promptId }).catch(() => {});
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
					await context?.helpers.prompts.getPrompts.prefetch({});
					await routes.apiUtils?.prompts.getPrompts.ensureData({}).catch(() => {});
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
						await context?.helpers.prompts.getPrompt.prefetch({ promptId });
						await routes.apiUtils?.prompts.getPrompt.ensureData({ promptId }).catch(() => {});
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

export type RemixBrowserContext = {
	apiUtils?: ApiUtils;
	queryClient?: QueryClient;
};

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
