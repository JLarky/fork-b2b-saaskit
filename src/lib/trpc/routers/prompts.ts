import { TRPCError } from '@trpc/server';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '../../../db/db';
import { gptKeys, promptLikes, prompts, sharedKeyRatelimit } from '../../../db/schema';
import { serverEnv } from '../../../t3-env';
import { callAction } from '../../actions/call-action';
import { createPrompt } from '../../actions/create-prompt';
import { getPrompt } from '../../actions/get-prompt';
import { listPrompts } from '../../actions/list-prompts';
import {
	messageSchema,
	privacyLevelSchema,
	type PromptPrivacyLevel,
} from '../../actions/prompt-shared';
import { actionContext } from '../../actions/registry';
import { trackEvent } from '../../posthog';
import { getStripeConfig, searchSubscriptionsByOrgId } from '../../stripe';
import {
	apiProcedure,
	authProcedure,
	createTRPCRouter,
	orgProcedure,
	publicProcedure,
} from '../trpc';

export type { PromptPrivacyLevel };

export const promptsRouter = createTRPCRouter({
	getPrompt: apiProcedure.input(getPrompt.schema).query(async ({ input, ctx }) => {
		const user = await ctx.userPromise;
		return callAction(() =>
			getPrompt.run(
				input,
				actionContext({
					user: user.kind === 'ok' ? user.user : undefined,
					orgId: ctx.userOrgId,
					requestUrl: ctx.req.url,
				})
			)
		);
	}),
	getPrompts: orgProcedure.query(async ({ ctx }) => {
		return callAction(() =>
			listPrompts.run(
				{},
				actionContext({
					user: ctx.user,
					orgId: ctx.requiredOrgId,
					requestUrl: ctx.req.url,
				})
			)
		);
	}),
	getPublicPrompts: publicProcedure.query(async () => {
		const promptsRes = await db
			.select()
			.from(prompts)
			.where(eq(prompts.privacyLevel, 'public'))
			.orderBy(sql`${prompts.createdAt} desc`)
			.limit(100);
		return promptsRes.map((x) => ({
			promptId: x.promptId,
			title: x.title,
			isPublic: x.privacyLevel === 'public',
		}));
	}),
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
			const title = input.title || 'Untitled';
			const description = input.description || '';
			const tags = (input.tags || []).map((x) => x.trim()).filter((x) => x.length > 0);
			const template = input.template;
			// TODO: check user and org access
			{
				const x = await db
					.select({
						userId: prompts.userId,
					})
					.from(prompts)
					.where(eq(prompts.promptId, input.promptId));
				const prompt = x[0];
				if (!prompt) {
					throw new TRPCError({
						code: 'NOT_FOUND',
						message: 'Prompt not found',
					});
				}

				if (prompt?.userId !== ctx.user.userId) {
					throw new TRPCError({
						code: 'FORBIDDEN',
						message: 'You can only update your own prompts, try saving a copy instead.',
					});
				}
			}
			trackEvent(ctx.user, 'prompt_updated');
			await db
				.update(prompts)
				.set({
					orgId: ctx.requiredOrgId,
					userId: ctx.user.userId,
					privacyLevel: input.privacyLevel,
					title,
					description,
					tags,
					template,
					updatedAt: new Date(),
				})
				.where(eq(prompts.promptId, input.promptId));
			return input.promptId;
		}),
	createPrompt: orgProcedure.input(createPrompt.schema).mutation(async ({ ctx, input }) => {
		return callAction(() =>
			createPrompt.run(
				input,
				actionContext({
					user: ctx.user,
					orgId: ctx.requiredOrgId,
					requestUrl: ctx.req.url,
				})
			)
		);
	}),
	deletePrompt: authProcedure
		.input(
			z.object({
				promptId: z.string(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const x = await db
				.select({
					userId: prompts.userId,
				})
				.from(prompts)
				.where(eq(prompts.promptId, input.promptId));
			const prompt = x[0];
			if (!prompt) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Prompt not found',
				});
			}

			if (prompt.userId !== ctx.user.userId) {
				throw new TRPCError({
					code: 'FORBIDDEN',
					message: 'You can only delete your own prompts',
				});
			}

			await db.delete(prompts).where(eq(prompts.promptId, input.promptId));
			await db.delete(promptLikes).where(eq(promptLikes.promptId, input.promptId));
			return input;
		}),
	runPrompt: orgProcedure
		.input(
			z.object({
				messages: z.array(z.object({ role: z.string(), content: z.string() })),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const keys = await db
				.select({
					keyId: gptKeys.keyId,
					keySecret: gptKeys.keySecret,
					keyType: gptKeys.keyType,
				})
				.from(gptKeys)
				.where(eq(gptKeys.orgId, ctx.requiredOrgId))
				.orderBy(gptKeys.createdAt);
			const key = keys[0];

			if (key) {
				await db
					.update(gptKeys)
					.set({
						lastUsedAt: new Date(),
					})
					.where(eq(gptKeys.keyId, key.keyId));
			}

			let secretKey: string;
			if (key) {
				secretKey = key.keySecret;
			} else {
				if (!serverEnv.OPENAI_API_KEY) {
					throw new TRPCError({
						code: 'NOT_FOUND',
						message: 'No OpenAI key found for this organization',
					});
				} else {
					let hasSubscription = false;
					if (ctx.requiredOrgId) {
						const stripeConfig = getStripeConfig();
						if (stripeConfig) {
							const res = await searchSubscriptionsByOrgId(stripeConfig, ctx.requiredOrgId);
							hasSubscription = res.some(({ active }) => active === true);
						}
					}

					const remaining = await rateLimitUpsert(ctx.user.userId, Date.now());

					if (hasSubscription || remaining > 0) {
						secretKey = serverEnv.OPENAI_API_KEY;
					} else {
						const message = serverEnv.STRIPE_SECRET_KEY
							? 'You have exceeded your daily rate limit. To fix this, add your own OpenAI key or purchase a subscription.'
							: 'You have exceeded your daily rate limit. To fix this, add your own OpenAI key.';
						throw new TRPCError({
							code: 'TOO_MANY_REQUESTS',
							message,
						});
					}
				}
			}

			const messages = input.messages;

			const res = await fetch('https://api.openai.com/v1/chat/completions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${secretKey}`,
				},
				body: JSON.stringify({
					model: key?.keyType === 'gpt-4' ? 'gpt-4' : 'gpt-3.5-turbo',
					messages,
				}),
			});
			const { error, choices } = (await res.json()) as {
				error?: { message: string; code: string };
				choices: {
					message: { content: string };
				}[];
			};
			if (error) {
				return { error: error.message || error.code };
			}

			const choice = choices[0];
			if (!choice) {
				return { error: 'No response from OpenAI' };
			}

			return { message: choice.message.content };
		}),

	getDefaultKey: authProcedure.query(async ({ ctx }) => {
		if (serverEnv.OPENAI_API_KEY) {
			const usage = await db
				.select({
					value: sharedKeyRatelimit.value,
				})
				.from(sharedKeyRatelimit)
				.where(eq(sharedKeyRatelimit.limitId, rateLimitSharedKeyId(ctx.user.userId, Date.now())));
			const spent = usage[0]?.value ?? 0;
			return {
				isSet: true,
				canUse: spent < limit,
				requestsRemaining: limit - spent,
				resetsAt: new Date(rateLimitSharedKeyResetsAt(Date.now())),
			};
		}

		return { isSet: false };
	}),
	likePrompt: authProcedure
		.input(
			z.object({
				promptId: z.string(),
				unlike: z.boolean().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			// you can like any prompt, even if you don't have access to it or it doesn't exist
			const userId = ctx.user.userId;
			if (input.unlike) {
				await db
					.delete(promptLikes)
					.where(and(eq(promptLikes.promptId, input.promptId), eq(promptLikes.userId, userId)));
				return input;
			} else {
				await db
					.insert(promptLikes)
					.values({ promptId: input.promptId, userId })
					.onConflictDoNothing();

				return input;
			}
		}),
});

// const period = 1000 * 5; // 5 seconds
const period = 1000 * 60 * 60 * 24; // 24 hours
const limit = 3;

function rateLimitSharedKeyId(userId: string, currentTimestamp: number) {
	return `shared_key:${userId}:${Math.floor(currentTimestamp / period)}`;
}

function rateLimitSharedKeyResetsAt(currentTimestamp: number) {
	return Math.ceil(currentTimestamp / period) * period;
}

/**
 * @returns the number of requests remaining
 */
async function rateLimitUpsert(userId: string, currentTimestamp: number) {
	// will do UPSERT
	const result = await db
		.insert(sharedKeyRatelimit)
		.values({
			limitId: rateLimitSharedKeyId(userId, currentTimestamp),
			value: 1,
		})
		.onConflictDoUpdate({
			target: sharedKeyRatelimit.limitId,
			set: {
				value: sql`${sharedKeyRatelimit.value} + 1`,
			},
		})
		.returning({
			value: sharedKeyRatelimit.value,
		});
	const first = result[0];
	if (!first) {
		throw new Error('No result from UPSERT');
	}

	// +1 to get the value that we had before the UPSERT
	return limit - first.value + 1;
}
