import { Effect, Exit, Layer } from 'effect';
import { describe, expect, it } from 'vitest';

import { Database } from '../services/Database';
import { createKeyHandler, deleteKeyHandler, getKeysHandler } from './settings';

function makeDbLayer(impl: Record<string, unknown>) {
	return Layer.succeed(Database, impl as never);
}

describe('getKeysHandler', () => {
	it('returns keys for the given org', async () => {
		const mockKeys = [
			{
				keyId: 1,
				keyType: 'gpt-3',
				createdAt: new Date(),
				lastUsedAt: null,
				keyPublic: 'sk-...1234',
				isShared: true,
			},
		];
		const db = {
			select: () => ({
				from: () => ({
					where: () => ({
						orderBy: () => Promise.resolve(mockKeys),
					}),
				}),
			}),
		};
		const result = await Effect.runPromise(
			getKeysHandler('org-1').pipe(Effect.provide(makeDbLayer(db)))
		);
		expect(result).toEqual(mockKeys);
	});
});

describe('createKeyHandler', () => {
	it('returns the new key id on success', async () => {
		const db = {
			transaction: async (fn: (trx: unknown) => Promise<void>) => {
				const trx = {
					delete: () => ({
						where: () => Promise.resolve(),
					}),
					insert: () => ({
						values: () => ({
							returning: () => Promise.resolve([{ id: 99 }]),
						}),
					}),
				};
				await fn(trx);
			},
		};
		const result = await Effect.runPromise(
			createKeyHandler('user-1', 'org-1', {
				keySecret: 'sk-test123456',
				keyType: 'gpt-4',
			}).pipe(Effect.provide(makeDbLayer(db)))
		);
		expect(result).toBe(99);
	});

	it('fails with NotFound when transaction returns no id', async () => {
		const db = {
			transaction: async (fn: (trx: unknown) => Promise<void>) => {
				const trx = {
					delete: () => ({ where: () => Promise.resolve() }),
					insert: () => ({
						values: () => ({
							returning: () => Promise.resolve([]),
						}),
					}),
				};
				await fn(trx);
			},
		};
		const exit = await Effect.runPromiseExit(
			createKeyHandler('user-1', 'org-1', {
				keySecret: 'sk-test',
				keyType: 'gpt-3',
			}).pipe(Effect.provide(makeDbLayer(db)))
		);
		expect(Exit.isFailure(exit)).toBe(true);
	});
});

describe('deleteKeyHandler', () => {
	it('deletes a key owned by the user', async () => {
		let deleted = false;
		const db = {
			select: () => ({
				from: () => ({
					where: () => Promise.resolve([{ userId: 'user-1', orgId: 'org-1' }]),
				}),
			}),
			transaction: async (fn: (trx: unknown) => Promise<void>) => {
				const trx = {
					delete: () => ({
						where: () => {
							deleted = true;
							return Promise.resolve();
						},
					}),
				};
				await fn(trx);
			},
		};
		const result = await Effect.runPromise(
			deleteKeyHandler('user-1', { keyId: 1 }).pipe(Effect.provide(makeDbLayer(db)))
		);
		expect(result).toEqual({ keyId: 1 });
		expect(deleted).toBe(true);
	});

	it('fails with NotFound when key does not exist', async () => {
		const db = {
			select: () => ({
				from: () => ({
					where: () => Promise.resolve([]),
				}),
			}),
		};
		const exit = await Effect.runPromiseExit(
			deleteKeyHandler('user-1', { keyId: 999 }).pipe(Effect.provide(makeDbLayer(db)))
		);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			expect(exit.cause.toString()).toContain('NotFound');
		}
	});

	it('fails with Forbidden when key belongs to another user', async () => {
		const db = {
			select: () => ({
				from: () => ({
					where: () => Promise.resolve([{ userId: 'other-user', orgId: 'org-1' }]),
				}),
			}),
		};
		const exit = await Effect.runPromiseExit(
			deleteKeyHandler('user-1', { keyId: 1 }).pipe(Effect.provide(makeDbLayer(db)))
		);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			expect(exit.cause.toString()).toContain('Forbidden');
		}
	});
});
