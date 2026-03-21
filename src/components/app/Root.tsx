import type { DehydratedState } from '@tanstack/react-query';
import type { StaticHandlerContext } from 'react-router-dom/server';

import { ApiProvider } from '../api';
import { BrowserRouter } from './BrowserRouter';
import { ServerRouter } from './ServerRouter';

export function Root(props: {
	dehydratedState?: DehydratedState;
	getContext?: () => StaticHandlerContext;
}) {
	if (import.meta.env.SSR) {
		return (
			<ApiProvider dehydratedState={props.dehydratedState}>
				<ServerRouter {...props} />
			</ApiProvider>
		);
	} else {
		return (
			<ApiProvider dehydratedState={props.dehydratedState}>
				<BrowserRouter />
			</ApiProvider>
		);
	}
}
