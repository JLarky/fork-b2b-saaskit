import type { User } from '@propelauth/node';
import { eq } from 'drizzle-orm';
import { Effect } from 'effect';
import { z } from 'zod';

import { db } from '../../../db/db';
import { gptKeys } from '../../../db/schema';
import { getStripeConfig, searchSubscriptionsByOrgId } from '../../stripe';
import { ApiCtx, AuthCtx, OrgCtx } from '../context';
import { BadRequest, Forbidden, InternalError, NotFound } from '../errors';

export const stripeConfigured = Effect.sync(() => getStripeConfig() !== undefined);

export const getSubscriptions = Effect.gen(function* () {
	const { req } = yield* ApiCtx;
	const { requiredOrgId } = yield* OrgCtx;
	const stripeConfig = getStripeConfig();
	if (!stripeConfig) {
		return [];
	}
	const returnUrl = new URL('/app/settings', req.url).toString();
	return yield* Effect.tryPromise({
		try: () => searchSubscriptionsByOrgId(stripeConfig, requiredOrgId, returnUrl),
		catch: () => new InternalError({ message: 'Failed to fetch subscriptions.' }),
	});
});

export const getKeys = Effect.gen(function* () {
	const { requiredOrgId } = yield* OrgCtx;
	return yield* Effect.tryPromise({
		try: () =>
			db
				.select({
					keyId: gptKeys.keyId,
					keyType: gptKeys.keyType,
					createdAt: gptKeys.createdAt,
					lastUsedAt: gptKeys.lastUsedAt,
					keyPublic: gptKeys.keyPublic,
					isShared: gptKeys.isShared,
				})
				.from(gptKeys)
				.where(eq(gptKeys.orgId, requiredOrgId))
				.orderBy(gptKeys.createdAt),
		catch: () => new InternalError({ message: 'Failed to fetch keys.' }),
	});
});

const createKeyInput = z.object({
	keySecret: z.string(),
	keyType: z.enum(['gpt-3', 'gpt-4']),
});

export type CreateKeyInput = z.infer<typeof createKeyInput>;

export const createKey = (rawInput: unknown) =>
	Effect.gen(function* () {
		const parsed = createKeyInput.safeParse(rawInput);
		if (!parsed.success) {
			return yield* Effect.fail(
				new BadRequest({ message: 'Invalid input', zodError: parsed.error.flatten() })
			);
		}
		const input = parsed.data;
		const { user } = yield* AuthCtx;
		const { requiredOrgId } = yield* OrgCtx;

		const result = yield* Effect.tryPromise({
			try: async () => {
				let keyId: number | undefined;
				await db.transaction(async (trx) => {
					await trx.delete(gptKeys).where(eq(gptKeys.orgId, requiredOrgId));
					const y = await trx
						.insert(gptKeys)
						.values({
							userId: user.userId,
							keySecret: input.keySecret,
							keyPublic: input.keySecret.slice(0, 3) + '...' + input.keySecret.slice(-4),
							keyType: input.keyType,
							orgId: requiredOrgId,
							isShared: true,
						})
						.returning({ id: gptKeys.keyId });
					if (y[0]) {
						keyId = y[0].id;
					}
				});
				return keyId;
			},
			catch: () => new InternalError({ message: 'Failed to store the key' }),
		});

		if (!result) {
			return yield* Effect.fail(new InternalError({ message: 'Failed to store the key' }));
		}
		return result;
	});

const deleteKeyInput = z.object({
	keyId: z.number(),
});

export type DeleteKeyInput = z.infer<typeof deleteKeyInput>;

export const deleteKey = (rawInput: unknown) =>
	Effect.gen(function* () {
		const parsed = deleteKeyInput.safeParse(rawInput);
		if (!parsed.success) {
			return yield* Effect.fail(
				new BadRequest({ message: 'Invalid input', zodError: parsed.error.flatten() })
			);
		}
		const input = parsed.data;
		const { user } = yield* AuthCtx;

		const x = yield* Effect.tryPromise({
			try: () =>
				db
					.select({ userId: gptKeys.userId, orgId: gptKeys.orgId })
					.from(gptKeys)
					.where(eq(gptKeys.keyId, input.keyId)),
			catch: () => new InternalError({ message: 'Failed to find key.' }),
		});
		const item = x[0];
		if (!item) {
			return yield* Effect.fail(new NotFound({ message: 'Key not found' }));
		}
		if (!canOnlyChangeOwnKey({ user }, item)) {
			return yield* Effect.fail(new Forbidden({ message: 'You can only delete your own keys.' }));
		}

		yield* Effect.tryPromise({
			try: () =>
				db.transaction(async (trx) => {
					await trx.delete(gptKeys).where(eq(gptKeys.keyId, input.keyId));
				}),
			catch: () => new InternalError({ message: 'Failed to delete key.' }),
		});
		return input;
	});

function canOnlyChangeOwnKey(ctx: { user: User }, item: { userId: string; orgId: string }) {
	return item.userId === ctx.user.userId;
}
