import { eq } from 'drizzle-orm';
import { Effect } from 'effect';

import { gptKeys } from '../db/schema';
import { Forbidden, NotFound } from '../errors';
import { getStripeConfig, searchSubscriptionsByOrgId } from '../lib/stripe';
import { Database } from '../services/Database';

export const stripeConfiguredHandler = Effect.sync(() => getStripeConfig() !== undefined);

export const getSubscriptionsHandler = (orgId: string, requestUrl: string) =>
	Effect.gen(function* () {
		const stripeConfig = getStripeConfig();
		if (!stripeConfig) return [];
		const returnUrl = new URL('/app/settings', requestUrl).toString();
		return yield* Effect.tryPromise(() =>
			searchSubscriptionsByOrgId(stripeConfig, orgId, returnUrl)
		);
	});

export const getKeysHandler = (orgId: string) =>
	Effect.gen(function* () {
		const db = yield* Database;
		return yield* Effect.tryPromise(() =>
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
				.where(eq(gptKeys.orgId, orgId))
				.orderBy(gptKeys.createdAt)
		);
	});

export const createKeyHandler = (
	userId: string,
	orgId: string,
	input: { keySecret: string; keyType: 'gpt-3' | 'gpt-4' }
) =>
	Effect.gen(function* () {
		const db = yield* Database;
		let keyId: number | undefined;
		yield* Effect.tryPromise(() =>
			db.transaction(async (trx) => {
				await trx.delete(gptKeys).where(eq(gptKeys.orgId, orgId));
				const y = await trx
					.insert(gptKeys)
					.values({
						userId,
						keySecret: input.keySecret,
						keyPublic: input.keySecret.slice(0, 3) + '...' + input.keySecret.slice(-4),
						keyType: input.keyType,
						orgId,
						isShared: true,
					})
					.returning({ id: gptKeys.keyId });
				if (y[0]) {
					keyId = y[0].id;
				}
			})
		);
		if (!keyId) {
			return yield* Effect.fail(new NotFound({ message: 'Failed to store the key' }));
		}
		return keyId;
	});

export const deleteKeyHandler = (userId: string, input: { keyId: number }) =>
	Effect.gen(function* () {
		const db = yield* Database;
		const x = yield* Effect.tryPromise(() =>
			db
				.select({ userId: gptKeys.userId, orgId: gptKeys.orgId })
				.from(gptKeys)
				.where(eq(gptKeys.keyId, input.keyId))
		);
		const item = x[0];
		if (!item) {
			return yield* Effect.fail(new NotFound({ message: 'Prompt not found' }));
		}
		if (item.userId !== userId) {
			return yield* Effect.fail(
				new Forbidden({ message: 'You can only delete your own prompts.' })
			);
		}
		yield* Effect.tryPromise(() =>
			db.transaction(async (trx) => {
				await trx.delete(gptKeys).where(eq(gptKeys.keyId, input.keyId));
			})
		);
		return input;
	});
