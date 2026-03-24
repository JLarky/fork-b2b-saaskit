import { ORPCError } from '@orpc/server';
import type { User } from '@propelauth/node';
import { and, eq, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';

import type { PrivacyLevel } from '../../../components/app/utils';
import { db } from '../../../db/db';
import { gptKeys, promptLikes, prompts, sharedKeyRatelimit } from '../../../db/schema';
import { serverEnv } from '../../../t3-env';
import { trackEvent } from '../../posthog';
import { propelauth } from '../../propelauth';
import { usersToPublicUserInfo } from '../../publicUserInfo';
import { getStripeConfig, searchSubscriptionsByOrgId } from '../../stripe';
import { apiProcedure, authProcedure, orgIdInput, orgProcedure, publicProcedure } from '../trpc';

const messageSchema = z.object({
	role: z.union([z.literal('user'), z.literal('assistant'), z.literal('system')]),
	content: z.string(),
});
type Message = z.infer<typeof messageSchema>;
const privacyLevelSchema = z.union([
	z.literal('public'),
	z.literal('team'),
	z.literal('unlisted'),
	z.literal('private'),
]);
export type PromptPrivacyLevel = z.infer<typeof privacyLevelSchema>;

export const promptsRouter = {
	getPrompt: apiProcedure
		.input(
			z.object({
				promptId: z.string(),
			})
		)
		.handler(async ({ input, context }) => {
			const user = await context.userPromise;
			const userData = user.kind === 'ok' ? user.user : undefined;
			const userId = userData?.userId;
			const res = await db
				.select({
					promptId: prompts.promptId,
					userId: prompts.userId,
					orgId: prompts.orgId,
					privacyLevel: prompts.privacyLevel,
					title: prompts.title,
					description: prompts.description,
					tags: prompts.tags,
					template: prompts.template,
					createdAt: prompts.createdAt,
					updatedAt: prompts.updatedAt,
					likes: sql<number>`count(${promptLikes.userId})::int`,
					myLike: sql<boolean>`SUM(CASE WHEN ${promptLikes.userId} = (${
						userId || null
					})::text THEN 1 ELSE 0 END) > 0`,
				})
				.from(prompts)
				.leftJoin(promptLikes, eq(promptLikes.promptId, prompts.promptId))
				.groupBy(prompts.promptId)
				.where(eq(prompts.promptId, input.promptId));
			const originalPrompt = res[0];
			if (!originalPrompt) {
				throw new ORPCError('NOT_FOUND', {
					message: `Prompt ${input.promptId} not found`,
				});
			}
			const validPrivacyLevel = privacyLevelSchema.safeParse(originalPrompt.privacyLevel);
			const prompt = {
				...originalPrompt,
				privacyLevel: validPrivacyLevel.success ? validPrivacyLevel.data : 'private',
			};
			const error = checkAccessToPrompt(prompt, userData);
			if (error) {
				if (error === 'UNAUTHORIZED') {
					throw new ORPCError('UNAUTHORIZED', {
						message: `You need to sign in to access this prompt`,
					});
				} else {
					throw new ORPCError('FORBIDDEN', {
						message: `You don't have access to this prompt`,
					});
				}
			}
			const users = await resolvePropelPublicUsers([prompt.userId]);
			const author = users.kind === 'ok' ? users.users[prompt.userId] : undefined;
			if (!author) {
				console.error('Error fetching users', users);
			}
			const { likes, template, tags, myLike, ...rest } = prompt;
			const validTemplate = z.array(messageSchema).safeParse(template);
			const validTags = z.array(z.string()).safeParse(tags);
			return {
				canEdit: prompt.userId === userId,
				likes,
				myLike,
				prompt: {
					...rest,
					template: validTemplate.success ? validTemplate.data : [],
					tags: validTags.success ? validTags.data : [],
				},
				author,
				shareUrl: new URL(context.req.url).origin + '/app/prompts/' + prompt.promptId,
				publicUrl: new URL(context.req.url).origin + '/prompts/' + prompt.promptId,
			};
		}),
	getPrompts: orgProcedure
		.input(z.object({ ...orgIdInput }).optional())
		.handler(async ({ context }) => {
			const p = (x: PromptPrivacyLevel) => x;
			const promptsRes = await db
				.select()
				.from(prompts)
				.where(
					and(
						eq(prompts.orgId, context.requiredOrgId),
						or(
							eq(prompts.privacyLevel, p('public')),
							eq(prompts.privacyLevel, p('unlisted')),
							eq(prompts.privacyLevel, p('team')),
							and(eq(prompts.privacyLevel, p('private')), eq(prompts.userId, context.user.userId))
						)
					)
				);
			const userIds = new Set<string>();
			promptsRes.forEach((x) => userIds.add(x.userId));
			const users = await resolvePropelPublicUsers([...userIds]);
			if (users.kind === 'error') {
				console.error('Error fetching users', users.error);
			}
			return promptsRes.map((x) => ({
				promptId: x.promptId,
				userId: x.userId,
				title: x.title,
				isPublic: x.privacyLevel === 'public',
				_meta: {
					user: users.kind === 'ok' ? users.users[x.userId] : undefined,
				},
			}));
		}),
	getPublicPrompts: publicProcedure.handler(async () => {
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
				...orgIdInput,
				promptId: z.string(),
				title: z.string().optional(),
				description: z.string().optional(),
				tags: z.array(z.string()),
				template: z.array(messageSchema),
				privacyLevel: privacyLevelSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const title = input.title || 'Untitled';
			const description = input.description || '';
			const tags = (input.tags || []).map((x) => x.trim()).filter((x) => x.length > 0);
			const template = input.template satisfies Message[];
			{
				const x = await db
					.select({
						userId: prompts.userId,
					})
					.from(prompts)
					.where(eq(prompts.promptId, input.promptId));
				const prompt = x[0];
				if (!prompt) {
					throw new ORPCError('NOT_FOUND', {
						message: 'Prompt not found',
					});
				}

				if (prompt?.userId !== context.user.userId) {
					throw new ORPCError('FORBIDDEN', {
						message: 'You can only update your own prompts, try saving a copy instead.',
					});
				}
			}
			trackEvent(context.user, 'prompt_updated');
			await db
				.update(prompts)
				.set({
					orgId: context.requiredOrgId,
					userId: context.user.userId,
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
	createPrompt: orgProcedure
		.input(
			z.object({
				...orgIdInput,
				title: z.string().optional(),
				description: z.string().optional(),
				tags: z.array(z.string()),
				template: z.array(messageSchema),
				privacyLevel: privacyLevelSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const title = input.title || 'Untitled';
			const description = input.description || '';
			const tags = (input.tags || []).map((x) => x.trim()).filter((x) => x.length > 0);
			const template = input.template satisfies Message[];
			trackEvent(context.user, 'prompt_created');
			const promptId = nanoid();
			await db.insert(prompts).values({
				orgId: context.requiredOrgId,
				promptId,
				userId: context.user.userId,
				privacyLevel: input.privacyLevel,
				title,
				description,
				tags,
				template,
			});
			await db.insert(promptLikes).values({
				promptId,
				userId: context.user.userId,
			});
			return promptId;
		}),
	deletePrompt: authProcedure
		.input(
			z.object({
				promptId: z.string(),
			})
		)
		.handler(async ({ context, input }) => {
			const x = await db
				.select({
					userId: prompts.userId,
				})
				.from(prompts)
				.where(eq(prompts.promptId, input.promptId));
			const prompt = x[0];
			if (!prompt) {
				throw new ORPCError('NOT_FOUND', {
					message: 'Prompt not found',
				});
			}

			if (prompt.userId !== context.user.userId) {
				throw new ORPCError('FORBIDDEN', {
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
				...orgIdInput,
				messages: z.array(z.object({ role: z.string(), content: z.string() })),
			})
		)
		.handler(async ({ context, input }) => {
			const keys = await db
				.select({
					keyId: gptKeys.keyId,
					keySecret: gptKeys.keySecret,
					keyType: gptKeys.keyType,
				})
				.from(gptKeys)
				.where(eq(gptKeys.orgId, context.requiredOrgId))
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
					throw new ORPCError('NOT_FOUND', {
						message: 'No OpenAI key found for this organization',
					});
				} else {
					let hasSubscription = false;
					if (context.requiredOrgId) {
						const stripeConfig = getStripeConfig();
						if (stripeConfig) {
							const res = await searchSubscriptionsByOrgId(stripeConfig, context.requiredOrgId);
							hasSubscription = res.some(({ active }) => active === true);
						}
					}

					const remaining = await rateLimitUpsert(context.user.userId, Date.now());

					if (hasSubscription || remaining > 0) {
						secretKey = serverEnv.OPENAI_API_KEY;
					} else {
						const message = serverEnv.STRIPE_SECRET_KEY
							? 'You have exceeded your daily rate limit. To fix this, add your own OpenAI key or purchase a subscription.'
							: 'You have exceeded your daily rate limit. To fix this, add your own OpenAI key.';
						throw new ORPCError('TOO_MANY_REQUESTS', {
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

	getDefaultKey: authProcedure.handler(async ({ context }) => {
		if (serverEnv.OPENAI_API_KEY) {
			const usage = await db
				.select({
					value: sharedKeyRatelimit.value,
				})
				.from(sharedKeyRatelimit)
				.where(
					eq(sharedKeyRatelimit.limitId, rateLimitSharedKeyId(context.user.userId, Date.now()))
				);
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
		.handler(async ({ context, input }) => {
			const userId = context.user.userId;
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
};

// const period = 1000 * 5; // 5 seconds
const period = 1000 * 60 * 60 * 24; // 24 hours
const limit = 3;

function rateLimitSharedKeyId(userId: string, currentTimestamp: number) {
	return `shared_key:${userId}:${Math.floor(currentTimestamp / period)}`;
}

function rateLimitSharedKeyResetsAt(currentTimestamp: number) {
	return Math.ceil(currentTimestamp / period) * period;
}

async function rateLimitUpsert(userId: string, currentTimestamp: number) {
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

	return limit - first.value + 1;
}

function resolvePropelAuthUsers(userIds: string[]) {
	return propelauth
		.fetchBatchUserMetadataByUserIds(userIds)
		.then((users) => ({ kind: 'ok' as const, users }))
		.catch((error) => ({ kind: 'error' as const, error }));
}

function resolvePropelPublicUsers(userIds: string[]) {
	return resolvePropelAuthUsers(userIds).then((result) => {
		if (result.kind === 'ok') {
			return { ...result, users: usersToPublicUserInfo(result.users) };
		}
		return result;
	});
}

function checkAccessToPrompt(
	prompt: { promptId: string; privacyLevel: PrivacyLevel; userId: string; orgId: string },
	user: User | undefined
) {
	const privacyLevel = prompt.privacyLevel;

	if (privacyLevel === 'public' || privacyLevel === 'unlisted') {
		return undefined;
	}
	if (!user) {
		return 'UNAUTHORIZED';
	}
	if (prompt.userId === user.userId) {
		return undefined;
	}
	if (privacyLevel === 'private') {
		return 'FORBIDDEN';
	}
	if (privacyLevel === 'team') {
		const hasAccess = user.orgIdToOrgMemberInfo?.[prompt.orgId] !== undefined;
		if (hasAccess) {
			return undefined;
		}
	}
	return 'FORBIDDEN';
}
