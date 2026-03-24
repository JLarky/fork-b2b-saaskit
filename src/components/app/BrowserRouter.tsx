import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { orpc } from '../trpc';
import { routes } from './routes';

export function BrowserRouter() {
	const queryClient = useQueryClient();
	const router = useState(() => {
		routes.queryClient = queryClient;
		routes.orpcUtils = orpc;
		return createBrowserRouter(routes);
	})[0];
	return <RouterProvider router={router} />;
}
