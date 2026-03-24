import { ORPCError } from '@orpc/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '../../../db/db';
import { surveys } from '../../../db/schema';
import { publicProcedure } from '../trpc';

export const surveysRouter = {
	getPublic: publicProcedure.handler(async () => {
		return await db
			.select({
				id: surveys.id,
				rating: surveys.rating,
				comments: surveys.comments,
				createdAt: surveys.createdAt,
			})
			.from(surveys)
			.where(eq(surveys.isPublic, true))
			.orderBy(desc(surveys.id));
	}),
	postSurvey: publicProcedure
		.input(
			z.object({
				rating: z.coerce.number().min(1).max(5),
				is_public: z
					.literal('on')
					.optional()
					.transform((checkbox) => checkbox === 'on'),
				comments: z.string().max(1500).optional(),
			})
		)
		.handler(async ({ input }) => {
			const x = await db
				.insert(surveys)
				.values({
					rating: input.rating,
					isPublic: input.is_public,
					comments: input.comments,
				})
				.returning({ id: surveys.id });
			const survey = x[0];
			if (!survey) {
				throw new ORPCError('INTERNAL_SERVER_ERROR', {
					message: 'Failed to create a survey.',
				});
			}

			return survey.id;
		}),
};
