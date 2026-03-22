import { Effect, Layer } from 'effect';
import { z } from 'zod';

import { authSyncHandler } from '../../../handlers/auth';
import { Auth } from '../../../services/Auth';
import { HttpRequest } from '../../../services/HttpRequest';
import { propelauth } from '../../propelauth';
import { apiProcedure, createTRPCRouter } from '../trpc';

export const authRouter = createTRPCRouter({
	authSync: apiProcedure
		.input(
			z.object({
				isLoggedIn: z.boolean(),
				accessToken: z.string().optional(),
				orgId: z.string(),
			})
		)
		.mutation(({ ctx, input }) =>
			Effect.runPromise(
				authSyncHandler(input).pipe(
					Effect.provide(
						Layer.mergeAll(
							Layer.succeed(Auth, propelauth),
							Layer.succeed(HttpRequest, {
								req: ctx.req,
								resHeaders: ctx.resHeaders,
							})
						)
					)
				)
			)
		),
});
