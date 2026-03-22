import { Effect, Layer } from 'effect';
import { z } from 'zod';

import { db } from '../../../db/db';
import {
	createPromptHandler,
	deletePromptHandler,
	getDefaultKeyHandler,
	getPromptHandler,
	getPromptsHandler,
	getPublicPromptsHandler,
	likePromptHandler,
	runPromptHandler,
	updatePromptHandler,
} from '../../../handlers/prompts';
import { Auth } from '../../../services/Auth';
import { Database } from '../../../services/Database';
import { serverEnv } from '../../../t3-env';
import { trackEvent } from '../../posthog';
import { propelauth } from '../../propelauth';
import {
	apiProcedure,
	authProcedure,
	createTRPCRouter,
	orgProcedure,
	publicProcedure,
} from '../trpc';

const messageSchema = z.object({
	role: z.union([z.literal('user'), z.literal('assistant'), z.literal('system')]),
	content: z.string(),
});
const privacyLevelSchema = z.union([
	z.literal('public'),
	z.literal('team'),
	z.literal('unlisted'),
	z.literal('private'),
]);

const provideDb = Effect.provide(Layer.succeed(Database, db));
const provideDbAndAuth = Effect.provide(
	Layer.mergeAll(Layer.succeed(Database, db), Layer.succeed(Auth, propelauth))
);

export const promptsRouter = createTRPCRouter({
	getPrompt: apiProcedure
		.input(z.object({ promptId: z.string() }))
		.query(async ({ input, ctx }) => {
			const userResult = await ctx.userPromise;
			const userData = userResult.kind === 'ok' ? userResult.user : undefined;
			return Effect.runPromise(
				getPromptHandler(input, userData, ctx.req.url).pipe(provideDbAndAuth)
			);
		}),
	getPrompts: orgProcedure.query(({ ctx }) =>
		Effect.runPromise(getPromptsHandler(ctx.requiredOrgId, ctx.user.userId).pipe(provideDbAndAuth))
	),
	getPublicPrompts: publicProcedure.query(() =>
		Effect.runPromise(getPublicPromptsHandler.pipe(provideDb))
	),
	updatePrompt: orgProcedure
		.input(
			z.object({
				promptId: z.string(),
				title: z.string().optional(),
				description: z.string().optional(),
				tags: z.array(z.string()),
				template: z.array(messageSchema),
				privacyLevel: privacyLevelSchema,
			})
		)
		.mutation(async ({ ctx, input }) => {
			trackEvent(ctx.user, 'prompt_updated');
			return Effect.runPromise(
				updatePromptHandler(ctx.user.userId, ctx.requiredOrgId, input).pipe(provideDb)
			);
		}),
	createPrompt: orgProcedure
		.input(
			z.object({
				title: z.string().optional(),
				description: z.string().optional(),
				tags: z.array(z.string()),
				template: z.array(messageSchema),
				privacyLevel: privacyLevelSchema,
			})
		)
		.mutation(async ({ ctx, input }) => {
			trackEvent(ctx.user, 'prompt_created');
			return Effect.runPromise(
				createPromptHandler(ctx.user.userId, ctx.requiredOrgId, input).pipe(provideDb)
			);
		}),
	deletePrompt: authProcedure
		.input(z.object({ promptId: z.string() }))
		.mutation(({ ctx, input }) =>
			Effect.runPromise(deletePromptHandler(ctx.user.userId, input).pipe(provideDb))
		),
	runPrompt: orgProcedure
		.input(
			z.object({
				messages: z.array(z.object({ role: z.string(), content: z.string() })),
			})
		)
		.mutation(({ ctx, input }) =>
			Effect.runPromise(
				runPromptHandler(
					ctx.user.userId,
					ctx.requiredOrgId,
					input,
					serverEnv.OPENAI_API_KEY,
					serverEnv.STRIPE_SECRET_KEY
				).pipe(provideDb)
			)
		),
	getDefaultKey: authProcedure.query(({ ctx }) =>
		Effect.runPromise(
			getDefaultKeyHandler(ctx.user.userId, serverEnv.OPENAI_API_KEY).pipe(provideDb)
		)
	),
	likePrompt: authProcedure
		.input(z.object({ promptId: z.string(), unlike: z.boolean().optional() }))
		.mutation(({ ctx, input }) =>
			Effect.runPromise(likePromptHandler(ctx.user.userId, input).pipe(provideDb))
		),
});

export type { PromptPrivacyLevel } from '../../../handlers/prompts';
