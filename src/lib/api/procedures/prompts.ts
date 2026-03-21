import type { User } from '@propelauth/node';
import { and, eq, or, sql } from 'drizzle-orm';
import { Effect } from 'effect';
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
import { ApiCtx, AuthCtx, OrgCtx } from '../context';
import { BadRequest, Forbidden, InternalError, NotFound, TooManyRequests, Unauthorized } from '../errors';

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

const getPromptInput = z.object({ promptId: z.string() });

export const getPrompt = (rawInput: unknown) =>
	Effect.gen(function* () {
		const parsed = getPromptInput.safeParse(rawInput);
		if (!parsed.success) {
			return yield* Effect.fail(new BadRequest({ message: 'Invalid input', zodError: parsed.error.flatten() }));
		}
		const input = parsed.data;
		const ctx = yield* ApiCtx;
		const userResult = yield* Effect.tryPromise({
			try: () => ctx.userPromise(),
			catch: () => new InternalError({ message: 'Failed to validate user' }),
		});
		const userData = userResult.kind === 'ok' ? userResult.user : undefined;
		const userId = userData?.userId;
		const res = yield* Effect.tryPromise({
			try: () =>
				db
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
					.where(eq(prompts.promptId, input.promptId)),
			catch: () => new InternalError({ message: 'Database error' }),
		});

		const originalPrompt = res[0];
		if (!originalPrompt) {
			return yield* Effect.fail(new NotFound({ message: `Prompt ${input.promptId} not found` }));
		}
		const validPrivacyLevel = privacyLevelSchema.safeParse(originalPrompt.privacyLevel);
		const prompt = {
			...originalPrompt,
			privacyLevel: validPrivacyLevel.success ? validPrivacyLevel.data : 'private',
		};
		const error = checkAccessToPrompt(prompt, userData);
		if (error) {
			if (error === 'UNAUTHORIZED') {
				return yield* Effect.fail(
					new Unauthorized({ message: 'You need to sign in to access this prompt' })
				);
			} else {
				return yield* Effect.fail(
					new Forbidden({ message: "You don't have access to this prompt" })
				);
			}
		}
		const users = yield* Effect.promise(() => resolvePropelPublicUsers([prompt.userId]));
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
			shareUrl: new URL(ctx.req.url).origin + '/app/prompts/' + prompt.promptId,
			publicUrl: new URL(ctx.req.url).origin + '/prompts/' + prompt.promptId,
		};
	});

export const getPrompts = Effect.gen(function* () {
	const { requiredOrgId } = yield* OrgCtx;
	const { user } = yield* AuthCtx;
	const p = (x: PromptPrivacyLevel) => x;
	const promptsRes = yield* Effect.tryPromise({
		try: () =>
			db
				.select()
				.from(prompts)
				.where(
					and(
						eq(prompts.orgId, requiredOrgId),
						or(
							eq(prompts.privacyLevel, p('public')),
							eq(prompts.privacyLevel, p('unlisted')),
							eq(prompts.privacyLevel, p('team')),
							and(eq(prompts.privacyLevel, p('private')), eq(prompts.userId, user.userId))
						)
					)
				),
		catch: () => new InternalError({ message: 'Database error' }),
	});
	const userIds = new Set<string>();
	promptsRes.forEach((x) => userIds.add(x.userId));
	const users = yield* Effect.promise(() => resolvePropelPublicUsers([...userIds]));
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
});

export const getPublicPrompts = Effect.tryPromise({
	try: async () => {
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
	},
	catch: () => new InternalError({ message: 'Database error' }),
});

const updatePromptInput = z.object({
	promptId: z.string(),
	title: z.string().optional(),
	description: z.string().optional(),
	tags: z.array(z.string()),
	template: z.array(messageSchema),
	privacyLevel: privacyLevelSchema,
});

export const updatePrompt = (rawInput: unknown) =>
	Effect.gen(function* () {
		const parsed = updatePromptInput.safeParse(rawInput);
		if (!parsed.success) {
			return yield* Effect.fail(new BadRequest({ message: 'Invalid input', zodError: parsed.error.flatten() }));
		}
		const input = parsed.data;
		const { user } = yield* AuthCtx;
		const { requiredOrgId } = yield* OrgCtx;
		const title = input.title || 'Untitled';
		const description = input.description || '';
		const tags = (input.tags || []).map((x) => x.trim()).filter((x) => x.length > 0);
		const template = input.template satisfies Message[];

		const x = yield* Effect.tryPromise({
			try: () =>
				db.select({ userId: prompts.userId }).from(prompts).where(eq(prompts.promptId, input.promptId)),
			catch: () => new InternalError({ message: 'Database error' }),
		});
		const promptRecord = x[0];
		if (!promptRecord) {
			return yield* Effect.fail(new NotFound({ message: 'Prompt not found' }));
		}
		if (promptRecord.userId !== user.userId) {
			return yield* Effect.fail(
				new Forbidden({ message: 'You can only update your own prompts, try saving a copy instead.' })
			);
		}

		trackEvent(user, 'prompt_updated');
		yield* Effect.tryPromise({
			try: () =>
				db
					.update(prompts)
					.set({
						orgId: requiredOrgId,
						userId: user.userId,
						privacyLevel: input.privacyLevel,
						title,
						description,
						tags,
						template,
						updatedAt: new Date(),
					})
					.where(eq(prompts.promptId, input.promptId)),
			catch: () => new InternalError({ message: 'Database error' }),
		});
		return input.promptId;
	});

const createPromptInput = z.object({
	title: z.string().optional(),
	description: z.string().optional(),
	tags: z.array(z.string()),
	template: z.array(messageSchema),
	privacyLevel: privacyLevelSchema,
});

export const createPrompt = (rawInput: unknown) =>
	Effect.gen(function* () {
		const parsed = createPromptInput.safeParse(rawInput);
		if (!parsed.success) {
			return yield* Effect.fail(new BadRequest({ message: 'Invalid input', zodError: parsed.error.flatten() }));
		}
		const input = parsed.data;
		const { user } = yield* AuthCtx;
		const { requiredOrgId } = yield* OrgCtx;
		const title = input.title || 'Untitled';
		const description = input.description || '';
		const tags = (input.tags || []).map((x) => x.trim()).filter((x) => x.length > 0);
		const template = input.template satisfies Message[];
		trackEvent(user, 'prompt_created');
		const promptId = nanoid();
		yield* Effect.tryPromise({
			try: () =>
				db.insert(prompts).values({
					orgId: requiredOrgId,
					promptId,
					userId: user.userId,
					privacyLevel: input.privacyLevel,
					title,
					description,
					tags,
					template,
				}),
			catch: () => new InternalError({ message: 'Database error' }),
		});
		yield* Effect.tryPromise({
			try: () => db.insert(promptLikes).values({ promptId, userId: user.userId }),
			catch: () => new InternalError({ message: 'Database error' }),
		});
		return promptId;
	});

const deletePromptInput = z.object({ promptId: z.string() });

export const deletePrompt = (rawInput: unknown) =>
	Effect.gen(function* () {
		const parsed = deletePromptInput.safeParse(rawInput);
		if (!parsed.success) {
			return yield* Effect.fail(new BadRequest({ message: 'Invalid input', zodError: parsed.error.flatten() }));
		}
		const input = parsed.data;
		const { user } = yield* AuthCtx;

		const x = yield* Effect.tryPromise({
			try: () => db.select({ userId: prompts.userId }).from(prompts).where(eq(prompts.promptId, input.promptId)),
			catch: () => new InternalError({ message: 'Database error' }),
		});
		const promptRecord = x[0];
		if (!promptRecord) {
			return yield* Effect.fail(new NotFound({ message: 'Prompt not found' }));
		}
		if (promptRecord.userId !== user.userId) {
			return yield* Effect.fail(new Forbidden({ message: 'You can only delete your own prompts' }));
		}
		yield* Effect.tryPromise({
			try: () => db.delete(prompts).where(eq(prompts.promptId, input.promptId)),
			catch: () => new InternalError({ message: 'Database error' }),
		});
		yield* Effect.tryPromise({
			try: () => db.delete(promptLikes).where(eq(promptLikes.promptId, input.promptId)),
			catch: () => new InternalError({ message: 'Database error' }),
		});
		return input;
	});

const runPromptInput = z.object({
	messages: z.array(z.object({ role: z.string(), content: z.string() })),
});

export const runPrompt = (rawInput: unknown) =>
	Effect.gen(function* () {
		const parsed = runPromptInput.safeParse(rawInput);
		if (!parsed.success) {
			return yield* Effect.fail(new BadRequest({ message: 'Invalid input', zodError: parsed.error.flatten() }));
		}
		const input = parsed.data;
		const { user } = yield* AuthCtx;
		const { requiredOrgId } = yield* OrgCtx;

		const keys = yield* Effect.tryPromise({
			try: () =>
				db
					.select({ keyId: gptKeys.keyId, keySecret: gptKeys.keySecret, keyType: gptKeys.keyType })
					.from(gptKeys)
					.where(eq(gptKeys.orgId, requiredOrgId))
					.orderBy(gptKeys.createdAt),
			catch: () => new InternalError({ message: 'Database error' }),
		});
		const key = keys[0];

		if (key) {
			yield* Effect.tryPromise({
				try: () => db.update(gptKeys).set({ lastUsedAt: new Date() }).where(eq(gptKeys.keyId, key.keyId)),
				catch: () => new InternalError({ message: 'Database error' }),
			});
		}

		let secretKey: string;
		if (key) {
			secretKey = key.keySecret;
		} else {
			if (!serverEnv.OPENAI_API_KEY) {
				return yield* Effect.fail(
					new NotFound({ message: 'No OpenAI key found for this organization' })
				);
			} else {
				let hasSubscription = false;
				if (requiredOrgId) {
					const stripeConfig = getStripeConfig();
					if (stripeConfig) {
						const res = yield* Effect.tryPromise({
							try: () => searchSubscriptionsByOrgId(stripeConfig, requiredOrgId),
							catch: () => new InternalError({ message: 'Stripe error' }),
						});
						hasSubscription = res.some(({ active }) => active === true);
					}
				}
				const remaining = yield* Effect.tryPromise({
					try: () => rateLimitUpsert(user.userId, Date.now()),
					catch: () => new InternalError({ message: 'Rate limit error' }),
				});
				if (hasSubscription || remaining > 0) {
					secretKey = serverEnv.OPENAI_API_KEY;
				} else {
					const message = serverEnv.STRIPE_SECRET_KEY
						? 'You have exceeded your daily rate limit. To fix this, add your own OpenAI key or purchase a subscription.'
						: 'You have exceeded your daily rate limit. To fix this, add your own OpenAI key.';
					return yield* Effect.fail(new TooManyRequests({ message }));
				}
			}
		}

		const messages = input.messages;
		const res = yield* Effect.tryPromise({
			try: () =>
				fetch('https://api.openai.com/v1/chat/completions', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${secretKey}`,
					},
					body: JSON.stringify({
						model: key?.keyType === 'gpt-4' ? 'gpt-4' : 'gpt-3.5-turbo',
						messages,
					}),
				}).then((r) => r.json()) as Promise<{
					error?: { message: string; code: string };
					choices: { message: { content: string } }[];
				}>,
			catch: () => new InternalError({ message: 'OpenAI API error' }),
		});

		if (res.error) {
			return { error: res.error.message || res.error.code };
		}

		const choice = res.choices[0];
		if (!choice) {
			return { error: 'No response from OpenAI' };
		}
		return { message: choice.message.content };
	});

export const getDefaultKey = Effect.gen(function* () {
	const { user } = yield* AuthCtx;
	if (serverEnv.OPENAI_API_KEY) {
		const usage = yield* Effect.tryPromise({
			try: () =>
				db
					.select({ value: sharedKeyRatelimit.value })
					.from(sharedKeyRatelimit)
					.where(eq(sharedKeyRatelimit.limitId, rateLimitSharedKeyId(user.userId, Date.now()))),
			catch: () => new InternalError({ message: 'Database error' }),
		});
		const spent = usage[0]?.value ?? 0;
		return {
			isSet: true,
			canUse: spent < limit,
			requestsRemaining: limit - spent,
			resetsAt: new Date(rateLimitSharedKeyResetsAt(Date.now())),
		};
	}
	return { isSet: false as const };
});

const likePromptInput = z.object({
	promptId: z.string(),
	unlike: z.boolean().optional(),
});

export const likePrompt = (rawInput: unknown) =>
	Effect.gen(function* () {
		const parsed = likePromptInput.safeParse(rawInput);
		if (!parsed.success) {
			return yield* Effect.fail(new BadRequest({ message: 'Invalid input', zodError: parsed.error.flatten() }));
		}
		const input = parsed.data;
		const { user } = yield* AuthCtx;
		const userId = user.userId;
		if (input.unlike) {
			yield* Effect.tryPromise({
				try: () =>
					db
						.delete(promptLikes)
						.where(and(eq(promptLikes.promptId, input.promptId), eq(promptLikes.userId, userId))),
				catch: () => new InternalError({ message: 'Database error' }),
			});
		} else {
			yield* Effect.tryPromise({
				try: () =>
					db.insert(promptLikes).values({ promptId: input.promptId, userId }).onConflictDoNothing(),
				catch: () => new InternalError({ message: 'Database error' }),
			});
		}
		return input;
	});

// Rate limiting helpers
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
		.values({ limitId: rateLimitSharedKeyId(userId, currentTimestamp), value: 1 })
		.onConflictDoUpdate({
			target: sharedKeyRatelimit.limitId,
			set: { value: sql`${sharedKeyRatelimit.value} + 1` },
		})
		.returning({ value: sharedKeyRatelimit.value });
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
