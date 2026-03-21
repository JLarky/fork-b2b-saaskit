import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { useApiUtils } from '../api';
import { routes } from './routes';

export function BrowserRouter() {
	const queryClient = useQueryClient();
	const apiUtils = useApiUtils();
	const router = useState(() => {
		routes.queryClient = queryClient;
		routes.apiUtils = apiUtils;
		return createBrowserRouter(routes);
	})[0];
	return <RouterProvider router={router} />;
}
