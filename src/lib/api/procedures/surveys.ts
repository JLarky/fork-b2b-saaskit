import { desc, eq } from 'drizzle-orm';
import { Effect } from 'effect';
import { z } from 'zod';

import { db } from '../../../db/db';
import { surveys } from '../../../db/schema';
import { BadRequest, InternalError } from '../errors';

export const getPublic = Effect.tryPromise({
	try: () =>
		db
			.select({
				id: surveys.id,
				rating: surveys.rating,
				comments: surveys.comments,
				createdAt: surveys.createdAt,
			})
			.from(surveys)
			.where(eq(surveys.isPublic, true))
			.orderBy(desc(surveys.id)),
	catch: () => new InternalError({ message: 'Failed to fetch surveys.' }),
});

const postSurveyInput = z.object({
	rating: z.coerce.number().min(1).max(5),
	is_public: z
		.literal('on')
		.optional()
		.transform((checkbox) => checkbox === 'on'),
	comments: z.string().max(1500).optional(),
});

export type PostSurveyInput = z.infer<typeof postSurveyInput>;

export const postSurvey = (rawInput: unknown) =>
	Effect.gen(function* () {
		const parsed = postSurveyInput.safeParse(rawInput);
		if (!parsed.success) {
			return yield* Effect.fail(
				new BadRequest({ message: 'Invalid input', zodError: parsed.error.flatten() })
			);
		}
		const input = parsed.data;
		const result = yield* Effect.tryPromise({
			try: () =>
				db
					.insert(surveys)
					.values({
						rating: input.rating,
						isPublic: input.is_public,
						comments: input.comments,
					})
					.returning({ id: surveys.id }),
			catch: () => new InternalError({ message: 'Failed to create a survey.' }),
		});
		const survey = result[0];
		if (!survey) {
			return yield* Effect.fail(new InternalError({ message: 'Failed to create a survey.' }));
		}
		return survey.id;
	});
