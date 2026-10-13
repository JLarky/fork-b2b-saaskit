import { TRPCError } from '@trpc/server';
import { ZodError } from 'zod';

import { ActionError } from './define-action';

/** Run an action from a tRPC procedure, preserving the error codes the UI already handles. */
export async function callAction<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		if (error instanceof ActionError) {
			throw new TRPCError({
				code: error.code,
				message: error.message,
				cause: error,
			});
		}
		if (error instanceof ZodError) {
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: error.message,
				cause: error,
			});
		}
		throw error;
	}
}
