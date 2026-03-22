import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import { Forbidden, NotFound, RateLimited, Unauthorized } from '../errors';

describe('Unauthorized', () => {
	it('is tagged and carries message', () => {
		const err = new Unauthorized({ message: 'bad token' });
		expect(err._tag).toBe('Unauthorized');
		expect(err.message).toBe('bad token');
	});
});

describe('Forbidden', () => {
	it('is tagged and carries message', () => {
		const err = new Forbidden({ message: 'no access' });
		expect(err._tag).toBe('Forbidden');
		expect(err.message).toBe('no access');
	});
});

describe('NotFound', () => {
	it('is tagged and carries message', () => {
		const err = new NotFound({ message: 'missing' });
		expect(err._tag).toBe('NotFound');
		expect(err.message).toBe('missing');
	});
});

describe('RateLimited', () => {
	it('carries message and resetsAt', () => {
		const resetsAt = new Date('2025-01-01T00:00:00Z');
		const err = new RateLimited({ message: 'slow down', resetsAt });
		expect(err._tag).toBe('RateLimited');
		expect(err.message).toBe('slow down');
		expect(err.resetsAt).toBe(resetsAt);
	});
});

describe('Effect.catchTags integration', () => {
	it('catches Unauthorized via tag', async () => {
		const program = Effect.gen(function* () {
			yield* Effect.fail(new Unauthorized({ message: 'test' }));
			return 'unreachable';
		}).pipe(
			Effect.catchTags({
				Unauthorized: (e) => Effect.succeed(`caught: ${e.message}`),
			})
		);
		const result = await Effect.runPromise(program);
		expect(result).toBe('caught: test');
	});

	it('catches RateLimited and accesses resetsAt', async () => {
		const resetsAt = new Date('2025-06-15T12:00:00Z');
		const program = Effect.gen(function* () {
			yield* Effect.fail(new RateLimited({ message: 'limit', resetsAt }));
			return 'unreachable';
		}).pipe(
			Effect.catchTag('RateLimited', (e) =>
				Effect.succeed(`rate limited until ${e.resetsAt.toISOString()}`)
			)
		);
		const result = await Effect.runPromise(program);
		expect(result).toBe('rate limited until 2025-06-15T12:00:00.000Z');
	});

	it('discriminates between error types', async () => {
		const failWith = (
			tag: 'auth' | 'forbidden' | 'notfound'
		): Effect.Effect<string, Unauthorized | Forbidden | NotFound> => {
			switch (tag) {
				case 'auth':
					return Effect.fail(new Unauthorized({ message: 'test' }));
				case 'forbidden':
					return Effect.fail(new Forbidden({ message: 'org mismatch' }));
				case 'notfound':
					return Effect.fail(new NotFound({ message: 'gone' }));
			}
		};
		const program = failWith('forbidden').pipe(
			Effect.catchTags({
				Unauthorized: () => Effect.succeed('was unauthorized'),
				Forbidden: (e) => Effect.succeed(`was forbidden: ${e.message}`),
				NotFound: () => Effect.succeed('was not found'),
			})
		);
		const result = await Effect.runPromise(program);
		expect(result).toBe('was forbidden: org mismatch');
	});
});
