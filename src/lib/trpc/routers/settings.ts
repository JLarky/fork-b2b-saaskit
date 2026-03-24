import { ORPCError } from '@orpc/server';
import type { User } from '@propelauth/node';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '../../../db/db';
import { gptKeys } from '../../../db/schema';
import { getStripeConfig, searchSubscriptionsByOrgId } from '../../stripe';
import { authProcedure, orgIdInput, orgProcedure } from '../trpc';

export const settingsRouter = {
	stripeConfigured: orgProcedure.input(z.object({ ...orgIdInput }).optional()).handler(async () => {
		return getStripeConfig() !== undefined;
	}),
	getSubscriptions: orgProcedure
		.input(z.object({ ...orgIdInput }).optional())
		.handler(async ({ context }) => {
			const stripeConfig = getStripeConfig();
			if (!stripeConfig) {
				return [];
			} else {
				const returnUrl = new URL('/app/settings', context.req.url).toString();
				return await searchSubscriptionsByOrgId(stripeConfig, context.requiredOrgId, returnUrl);
			}
		}),
	getKeys: orgProcedure
		.input(z.object({ ...orgIdInput }).optional())
		.handler(async ({ context }) => {
			return await db
				.select({
					keyId: gptKeys.keyId,
					keyType: gptKeys.keyType,
					createdAt: gptKeys.createdAt,
					lastUsedAt: gptKeys.lastUsedAt,
					keyPublic: gptKeys.keyPublic,
					isShared: gptKeys.isShared,
				})
				.from(gptKeys)
				.where(eq(gptKeys.orgId, context.requiredOrgId))
				.orderBy(gptKeys.createdAt);
		}),
	createKey: orgProcedure
		.input(
			z.object({
				...orgIdInput,
				keySecret: z.string(),
				keyType: z.enum(['gpt-3', 'gpt-4']),
			})
		)
		.handler(async ({ context, input }) => {
			let keyId: number | undefined;
			await db.transaction(async (trx) => {
				await trx.delete(gptKeys).where(eq(gptKeys.orgId, context.requiredOrgId));
				const y = await trx
					.insert(gptKeys)
					.values({
						userId: context.user.userId,
						keySecret: input.keySecret,
						keyPublic: input.keySecret.slice(0, 3) + '...' + input.keySecret.slice(-4),
						keyType: input.keyType,
						orgId: context.requiredOrgId,
						isShared: true,
					})
					.returning({ id: gptKeys.keyId });
				if (y[0]) {
					keyId = y[0].id;
				}
			});
			if (!keyId) {
				throw new ORPCError('INTERNAL_SERVER_ERROR', {
					message: 'Failed to store the key',
				});
			}

			return keyId;
		}),
	deleteKey: authProcedure
		.input(
			z.object({
				keyId: z.number(),
			})
		)
		.handler(async ({ context, input }) => {
			const x = await db
				.select({
					userId: gptKeys.userId,
					orgId: gptKeys.orgId,
				})
				.from(gptKeys)
				.where(eq(gptKeys.keyId, input.keyId));
			const item = x[0];
			if (!item) {
				throw new ORPCError('NOT_FOUND', {
					message: 'Key not found',
				});
			}

			if (!canOnlyChangeOwnKey(context, item)) {
				throw new ORPCError('FORBIDDEN', {
					message: 'You can only delete your own keys.',
				});
			}

			await db.transaction(async (trx) => {
				await trx.delete(gptKeys).where(eq(gptKeys.keyId, input.keyId));
			});
			return input;
		}),
};

function canOnlyChangeOwnKey(ctx: { user: User }, item: { userId: string; orgId: string }) {
	return item.userId === ctx.user.userId;
}
