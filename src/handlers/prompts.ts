import type { User } from '@propelauth/node';
import { and, eq, or, sql } from 'drizzle-orm';
import { Effect } from 'effect';
import { nanoid } from 'nanoid';
import { z } from 'zod';

import type { PrivacyLevel } from '../components/app/utils';
import { gptKeys, promptLikes, prompts, sharedKeyRatelimit } from '../db/schema';
import { Forbidden, NotFound, RateLimited, Unauthorized } from '../errors';
import { usersToPublicUserInfo } from '../lib/publicUserInfo';
import { getStripeConfig, searchSubscriptionsByOrgId } from '../lib/stripe';
import { Auth } from '../services/Auth';
import { Database } from '../services/Database';

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

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const period = 1000 * 60 * 60 * 24; // 24 hours
const limit = 3;

export function rateLimitSharedKeyId(userId: string, currentTimestamp: number) {
	return `shared_key:${userId}:${Math.floor(currentTimestamp / period)}`;
}

export function rateLimitSharedKeyResetsAt(currentTimestamp: number) {
	return Math.ceil(currentTimestamp / period) * period;
}

export function checkAccessToPrompt(
	prompt: { promptId: string; privacyLevel: PrivacyLevel; userId: string; orgId: string },
	user: User | undefined
) {
	const { privacyLevel } = prompt;
	if (privacyLevel === 'public' || privacyLevel === 'unlisted') return undefined;
	if (!user) return 'UNAUTHORIZED';
	if (prompt.userId === user.userId) return undefined;
	if (privacyLevel === 'private') return 'FORBIDDEN';
	if (privacyLevel === 'team') {
		if (user.orgIdToOrgMemberInfo?.[prompt.orgId] !== undefined) return undefined;
	}
	return 'FORBIDDEN';
}

// ---------------------------------------------------------------------------
// Effect helpers
// ---------------------------------------------------------------------------

export const rateLimitUpsert = (userId: string, currentTimestamp: number) =>
	Effect.gen(function* () {
		const db = yield* Database;
		const result = yield* Effect.tryPromise(() =>
			db
				.insert(sharedKeyRatelimit)
				.values({
					limitId: rateLimitSharedKeyId(userId, currentTimestamp),
					value: 1,
				})
				.onConflictDoUpdate({
					target: sharedKeyRatelimit.limitId,
					set: { value: sql`${sharedKeyRatelimit.value} + 1` },
				})
				.returning({ value: sharedKeyRatelimit.value })
		);
		const first = result[0];
		if (!first) throw new Error('No result from UPSERT');
		return limit - first.value + 1;
	});

function resolvePropelAuthUsers(userIds: string[]) {
	return Effect.gen(function* () {
		const auth = yield* Auth;
		return yield* Effect.tryPromise({
			try: () =>
				auth
					.fetchBatchUserMetadataByUserIds(userIds)
					.then((users) => ({ kind: 'ok' as const, users })),
			catch: (error: unknown) => error,
		}).pipe(Effect.catchAll((error) => Effect.succeed({ kind: 'error' as const, error })));
	});
}

function resolvePropelPublicUsers(userIds: string[]) {
	return resolvePropelAuthUsers(userIds).pipe(
		Effect.map((result) => {
			if (result.kind === 'ok') {
				return { ...result, users: usersToPublicUserInfo(result.users) };
			}
			return result;
		})
	);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const getPublicPromptsHandler = Effect.gen(function* () {
	const db = yield* Database;
	const promptsRes = yield* Effect.tryPromise(() =>
		db
			.select()
			.from(prompts)
			.where(eq(prompts.privacyLevel, 'public'))
			.orderBy(sql`${prompts.createdAt} desc`)
			.limit(100)
	);
	return promptsRes.map((x) => ({
		promptId: x.promptId,
		title: x.title,
		isPublic: x.privacyLevel === 'public',
	}));
});

export const getPromptHandler = (
	input: { promptId: string },
	userData: User | undefined,
	requestUrl: string
) =>
	Effect.gen(function* () {
		const db = yield* Database;
		const userId = userData?.userId;
		const res = yield* Effect.tryPromise(() =>
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
				.where(eq(prompts.promptId, input.promptId))
		);
		const originalPrompt = res[0];
		if (!originalPrompt) {
			return yield* Effect.fail(new NotFound({ message: `Prompt ${input.promptId} not found` }));
		}
		const validPrivacyLevel = privacyLevelSchema.safeParse(originalPrompt.privacyLevel);
		const prompt = {
			...originalPrompt,
			privacyLevel: validPrivacyLevel.success ? validPrivacyLevel.data : ('private' as const),
		};
		const accessError = checkAccessToPrompt(prompt, userData);
		if (accessError === 'UNAUTHORIZED') {
			return yield* Effect.fail(
				new Unauthorized({ message: 'You need to sign in to access this prompt' })
			);
		}
		if (accessError === 'FORBIDDEN') {
			return yield* Effect.fail(new Forbidden({ message: "You don't have access to this prompt" }));
		}
		const users = yield* resolvePropelPublicUsers([prompt.userId]);
		const author = users.kind === 'ok' ? users.users[prompt.userId] : undefined;
		if (!author) {
			console.error('Error fetching users', users);
		}
		const { likes, template, tags, myLike, ...rest } = prompt;
		const validTemplate = z.array(messageSchema).safeParse(template);
		const validTags = z.array(z.string()).safeParse(tags);
		const origin = new URL(requestUrl).origin;
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
			shareUrl: origin + '/app/prompts/' + prompt.promptId,
			publicUrl: origin + '/prompts/' + prompt.promptId,
		};
	});

export const getPromptsHandler = (orgId: string, userId: string) =>
	Effect.gen(function* () {
		const db = yield* Database;
		const p = (x: PromptPrivacyLevel) => x;
		const promptsRes = yield* Effect.tryPromise(() =>
			db
				.select()
				.from(prompts)
				.where(
					and(
						eq(prompts.orgId, orgId),
						or(
							eq(prompts.privacyLevel, p('public')),
							eq(prompts.privacyLevel, p('unlisted')),
							eq(prompts.privacyLevel, p('team')),
							and(eq(prompts.privacyLevel, p('private')), eq(prompts.userId, userId))
						)
					)
				)
		);
		const userIds = new Set<string>();
		promptsRes.forEach((x) => userIds.add(x.userId));
		const users = yield* resolvePropelPublicUsers([...userIds]);
		if (users.kind === 'error') {
			console.error('Error fetching users', users.error);
		}
		return promptsRes.map((x) => ({
			promptId: x.promptId,
			userId: x.userId,
			title: x.title,
			isPublic: x.privacyLevel === 'public',
			_meta: { user: users.kind === 'ok' ? users.users[x.userId] : undefined },
		}));
	});

export const updatePromptHandler = (
	userId: string,
	orgId: string,
	input: {
		promptId: string;
		title?: string;
		description?: string;
		tags: string[];
		template: Message[];
		privacyLevel: PromptPrivacyLevel;
	}
) =>
	Effect.gen(function* () {
		const db = yield* Database;
		const title = input.title || 'Untitled';
		const description = input.description || '';
		const tags = (input.tags || []).map((x) => x.trim()).filter((x) => x.length > 0);
		const template = input.template satisfies Message[];
		{
			const x = yield* Effect.tryPromise(() =>
				db
					.select({ userId: prompts.userId })
					.from(prompts)
					.where(eq(prompts.promptId, input.promptId))
			);
			const prompt = x[0];
			if (!prompt) {
				return yield* Effect.fail(new NotFound({ message: 'Prompt not found' }));
			}
			if (prompt.userId !== userId) {
				return yield* Effect.fail(
					new Forbidden({
						message: 'You can only update your own prompts, try saving a copy instead.',
					})
				);
			}
		}
		yield* Effect.tryPromise(() =>
			db
				.update(prompts)
				.set({
					orgId,
					userId,
					privacyLevel: input.privacyLevel,
					title,
					description,
					tags,
					template,
					updatedAt: new Date(),
				})
				.where(eq(prompts.promptId, input.promptId))
		);
		return input.promptId;
	});

export const createPromptHandler = (
	userId: string,
	orgId: string,
	input: {
		title?: string;
		description?: string;
		tags: string[];
		template: Message[];
		privacyLevel: PromptPrivacyLevel;
	}
) =>
	Effect.gen(function* () {
		const db = yield* Database;
		const title = input.title || 'Untitled';
		const description = input.description || '';
		const tags = (input.tags || []).map((x) => x.trim()).filter((x) => x.length > 0);
		const template = input.template satisfies Message[];
		const promptId = nanoid();
		yield* Effect.tryPromise(() =>
			db.insert(prompts).values({
				orgId,
				promptId,
				userId,
				privacyLevel: input.privacyLevel,
				title,
				description,
				tags,
				template,
			})
		);
		yield* Effect.tryPromise(() => db.insert(promptLikes).values({ promptId, userId }));
		return promptId;
	});

export const deletePromptHandler = (userId: string, input: { promptId: string }) =>
	Effect.gen(function* () {
		const db = yield* Database;
		const x = yield* Effect.tryPromise(() =>
			db
				.select({ userId: prompts.userId })
				.from(prompts)
				.where(eq(prompts.promptId, input.promptId))
		);
		const prompt = x[0];
		if (!prompt) {
			return yield* Effect.fail(new NotFound({ message: 'Prompt not found' }));
		}
		if (prompt.userId !== userId) {
			return yield* Effect.fail(new Forbidden({ message: 'You can only delete your own prompts' }));
		}
		yield* Effect.tryPromise(() => db.delete(prompts).where(eq(prompts.promptId, input.promptId)));
		yield* Effect.tryPromise(() =>
			db.delete(promptLikes).where(eq(promptLikes.promptId, input.promptId))
		);
		return input;
	});

export const runPromptHandler = (
	userId: string,
	orgId: string,
	input: { messages: { role: string; content: string }[] },
	openaiApiKey: string | undefined,
	stripeSecretKey: string | undefined
) =>
	Effect.gen(function* () {
		const db = yield* Database;
		const keys = yield* Effect.tryPromise(() =>
			db
				.select({ keyId: gptKeys.keyId, keySecret: gptKeys.keySecret, keyType: gptKeys.keyType })
				.from(gptKeys)
				.where(eq(gptKeys.orgId, orgId))
				.orderBy(gptKeys.createdAt)
		);
		const key = keys[0];
		if (key) {
			yield* Effect.tryPromise(() =>
				db.update(gptKeys).set({ lastUsedAt: new Date() }).where(eq(gptKeys.keyId, key.keyId))
			);
		}
		let secretKey: string;
		if (key) {
			secretKey = key.keySecret;
		} else {
			if (!openaiApiKey) {
				return yield* Effect.fail(
					new NotFound({ message: 'No OpenAI key found for this organization' })
				);
			}
			let hasSubscription = false;
			if (orgId) {
				const stripeConfig = getStripeConfig();
				if (stripeConfig) {
					const res = yield* Effect.tryPromise(() =>
						searchSubscriptionsByOrgId(stripeConfig, orgId)
					);
					hasSubscription = res.some(({ active }) => active === true);
				}
			}
			const remaining = yield* rateLimitUpsert(userId, Date.now());
			if (hasSubscription || remaining > 0) {
				secretKey = openaiApiKey;
			} else {
				const message = stripeSecretKey
					? 'You have exceeded your daily rate limit. To fix this, add your own OpenAI key or purchase a subscription.'
					: 'You have exceeded your daily rate limit. To fix this, add your own OpenAI key.';
				return yield* Effect.fail(
					new RateLimited({ message, resetsAt: new Date(rateLimitSharedKeyResetsAt(Date.now())) })
				);
			}
		}
		const res = yield* Effect.tryPromise(() =>
			fetch('https://api.openai.com/v1/chat/completions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secretKey}` },
				body: JSON.stringify({
					model: key?.keyType === 'gpt-4' ? 'gpt-4' : 'gpt-3.5-turbo',
					messages: input.messages,
				}),
			}).then(
				(r) =>
					r.json() as Promise<{
						error?: { message: string; code: string };
						choices: { message: { content: string } }[];
					}>
			)
		);
		if (res.error) return { error: res.error.message || res.error.code };
		const choice = res.choices[0];
		if (!choice) return { error: 'No response from OpenAI' };
		return { message: choice.message.content };
	});

export const getDefaultKeyHandler = (userId: string, openaiApiKey: string | undefined) =>
	Effect.gen(function* () {
		if (openaiApiKey) {
			const db = yield* Database;
			const usage = yield* Effect.tryPromise(() =>
				db
					.select({ value: sharedKeyRatelimit.value })
					.from(sharedKeyRatelimit)
					.where(eq(sharedKeyRatelimit.limitId, rateLimitSharedKeyId(userId, Date.now())))
			);
			const spent = usage[0]?.value ?? 0;
			return {
				isSet: true as const,
				canUse: spent < limit,
				requestsRemaining: limit - spent,
				resetsAt: new Date(rateLimitSharedKeyResetsAt(Date.now())),
			};
		}
		return { isSet: false as const };
	});

export const likePromptHandler = (userId: string, input: { promptId: string; unlike?: boolean }) =>
	Effect.gen(function* () {
		const db = yield* Database;
		if (input.unlike) {
			yield* Effect.tryPromise(() =>
				db
					.delete(promptLikes)
					.where(and(eq(promptLikes.promptId, input.promptId), eq(promptLikes.userId, userId)))
			);
		} else {
			yield* Effect.tryPromise(() =>
				db.insert(promptLikes).values({ promptId: input.promptId, userId }).onConflictDoNothing()
			);
		}
		return input;
	});
