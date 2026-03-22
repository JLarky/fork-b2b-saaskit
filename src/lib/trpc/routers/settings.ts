import { Effect, Layer } from 'effect';
import { z } from 'zod';

import { db } from '../../../db/db';
import {
	createKeyHandler,
	deleteKeyHandler,
	getKeysHandler,
	getSubscriptionsHandler,
	stripeConfiguredHandler,
} from '../../../handlers/settings';
import { Database } from '../../../services/Database';
import { authProcedure, createTRPCRouter, orgProcedure } from '../trpc';

const provideDb = Effect.provide(Layer.succeed(Database, db));

export const settingsRouter = createTRPCRouter({
	stripeConfigured: orgProcedure.query(() => Effect.runPromise(stripeConfiguredHandler)),
	getSubscriptions: orgProcedure.query(({ ctx }) =>
		Effect.runPromise(getSubscriptionsHandler(ctx.requiredOrgId, ctx.req.url))
	),
	getKeys: orgProcedure.query(({ ctx }) =>
		Effect.runPromise(getKeysHandler(ctx.requiredOrgId).pipe(provideDb))
	),
	createKey: orgProcedure
		.input(
			z.object({
				keySecret: z.string(),
				keyType: z.enum(['gpt-3', 'gpt-4']),
			})
		)
		.mutation(({ ctx, input }) =>
			Effect.runPromise(createKeyHandler(ctx.user.userId, ctx.requiredOrgId, input).pipe(provideDb))
		),
	deleteKey: authProcedure
		.input(
			z.object({
				keyId: z.number(),
			})
		)
		.mutation(({ ctx, input }) =>
			Effect.runPromise(deleteKeyHandler(ctx.user.userId, input).pipe(provideDb))
		),
});
