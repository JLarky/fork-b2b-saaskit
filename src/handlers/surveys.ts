import { desc, eq } from 'drizzle-orm';
import { Effect } from 'effect';

import { surveys } from '../db/schema';
import { NotFound } from '../errors';
import { Database } from '../services/Database';

export const getPublicSurveys = Effect.gen(function* () {
	const db = yield* Database;
	return yield* Effect.tryPromise(() =>
		db
			.select({
				id: surveys.id,
				rating: surveys.rating,
				comments: surveys.comments,
				createdAt: surveys.createdAt,
			})
			.from(surveys)
			.where(eq(surveys.isPublic, true))
			.orderBy(desc(surveys.id))
	);
});

export const postSurvey = (input: { rating: number; isPublic: boolean; comments?: string }) =>
	Effect.gen(function* () {
		const db = yield* Database;
		const x = yield* Effect.tryPromise(() =>
			db
				.insert(surveys)
				.values({
					rating: input.rating,
					isPublic: input.isPublic,
					comments: input.comments,
				})
				.returning({ id: surveys.id })
		);
		const survey = x[0];
		if (!survey) {
			return yield* Effect.fail(new NotFound({ message: 'Failed to create a survey.' }));
		}
		return survey.id;
	});
