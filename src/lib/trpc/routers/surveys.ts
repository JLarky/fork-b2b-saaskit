import { Effect, Layer } from 'effect';
import { z } from 'zod';

import { db } from '../../../db/db';
import { getPublicSurveys, postSurvey } from '../../../handlers/surveys';
import { Database } from '../../../services/Database';
import { createTRPCRouter, publicProcedure } from '../trpc';

const provide = Effect.provide(Layer.succeed(Database, db));

export const surveysRouter = createTRPCRouter({
	getPublic: publicProcedure.query(() => Effect.runPromise(getPublicSurveys.pipe(provide))),
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
		.mutation(({ input }) =>
			Effect.runPromise(
				postSurvey({
					rating: input.rating,
					isPublic: input.is_public,
					comments: input.comments,
				}).pipe(provide)
			)
		),
});
