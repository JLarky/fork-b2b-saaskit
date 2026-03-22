import { Effect, Exit, Layer } from 'effect';
import { describe, expect, it } from 'vitest';

import { Database } from '../services/Database';
import { getPublicSurveys, postSurvey } from './surveys';

function makeDbLayer(impl: Record<string, (...args: unknown[]) => unknown>) {
	return Layer.succeed(Database, impl as never);
}

describe('getPublicSurveys', () => {
	it('returns public surveys from the database', async () => {
		const mockSurveys = [
			{ id: 1, rating: 5, comments: 'great', createdAt: new Date() },
			{ id: 2, rating: 3, comments: null, createdAt: new Date() },
		];
		const db = {
			select: () => ({
				from: () => ({
					where: () => ({
						orderBy: () => Promise.resolve(mockSurveys),
					}),
				}),
			}),
		};
		const result = await Effect.runPromise(
			getPublicSurveys.pipe(Effect.provide(makeDbLayer(db as never)))
		);
		expect(result).toEqual(mockSurveys);
	});

	it('returns empty array when no public surveys', async () => {
		const db = {
			select: () => ({
				from: () => ({
					where: () => ({
						orderBy: () => Promise.resolve([]),
					}),
				}),
			}),
		};
		const result = await Effect.runPromise(
			getPublicSurveys.pipe(Effect.provide(makeDbLayer(db as never)))
		);
		expect(result).toEqual([]);
	});
});

describe('postSurvey', () => {
	it('returns the new survey id on success', async () => {
		const db = {
			insert: () => ({
				values: () => ({
					returning: () => Promise.resolve([{ id: 42 }]),
				}),
			}),
		};
		const result = await Effect.runPromise(
			postSurvey({ rating: 5, isPublic: true, comments: 'awesome' }).pipe(
				Effect.provide(makeDbLayer(db as never))
			)
		);
		expect(result).toBe(42);
	});

	it('fails with NotFound when insert returns empty', async () => {
		const db = {
			insert: () => ({
				values: () => ({
					returning: () => Promise.resolve([]),
				}),
			}),
		};
		const exit = await Effect.runPromiseExit(
			postSurvey({ rating: 3, isPublic: false }).pipe(Effect.provide(makeDbLayer(db as never)))
		);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			const error = exit.cause.toString();
			expect(error).toContain('NotFound');
			expect(error).toContain('Failed to create a survey');
		}
	});
});
