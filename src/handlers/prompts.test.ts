import type { User } from '@propelauth/node';
import { Effect, Exit, Layer } from 'effect';
import { describe, expect, it } from 'vitest';

import { Database } from '../services/Database';
import {
	checkAccessToPrompt,
	createPromptHandler,
	deletePromptHandler,
	getPublicPromptsHandler,
	likePromptHandler,
	rateLimitSharedKeyId,
	rateLimitSharedKeyResetsAt,
} from './prompts';

function makeDbLayer(impl: Record<string, unknown>) {
	return Layer.succeed(Database, impl as never);
}

// ---------------------------------------------------------------------------
// Pure helper tests
// ---------------------------------------------------------------------------

describe('rateLimitSharedKeyId', () => {
	it('includes user id and period bucket', () => {
		const id = rateLimitSharedKeyId('user-1', 1000000);
		expect(id).toContain('user-1');
		expect(id).toContain('shared_key');
	});
});

describe('rateLimitSharedKeyResetsAt', () => {
	it('returns the next period boundary', () => {
		const period = 1000 * 60 * 60 * 24;
		const now = period * 2.5;
		const resetsAt = rateLimitSharedKeyResetsAt(now);
		expect(resetsAt).toBe(period * 3);
	});
});

describe('checkAccessToPrompt', () => {
	const basePrompt = { promptId: 'p1', userId: 'u1', orgId: 'org-1' };
	const user = { userId: 'u1', orgIdToOrgMemberInfo: { 'org-1': {} } } as unknown as User;
	const otherUser = { userId: 'u2', orgIdToOrgMemberInfo: { 'org-1': {} } } as unknown as User;
	const noOrgUser = { userId: 'u2', orgIdToOrgMemberInfo: {} } as unknown as User;

	it('allows access to public prompts', () => {
		expect(
			checkAccessToPrompt({ ...basePrompt, privacyLevel: 'public' }, undefined)
		).toBeUndefined();
	});

	it('allows access to unlisted prompts', () => {
		expect(
			checkAccessToPrompt({ ...basePrompt, privacyLevel: 'unlisted' }, undefined)
		).toBeUndefined();
	});

	it('requires auth for private prompts', () => {
		expect(checkAccessToPrompt({ ...basePrompt, privacyLevel: 'private' }, undefined)).toBe(
			'UNAUTHORIZED'
		);
	});

	it('allows owner access to private prompts', () => {
		expect(checkAccessToPrompt({ ...basePrompt, privacyLevel: 'private' }, user)).toBeUndefined();
	});

	it('denies non-owner access to private prompts', () => {
		expect(checkAccessToPrompt({ ...basePrompt, privacyLevel: 'private' }, otherUser)).toBe(
			'FORBIDDEN'
		);
	});

	it('allows team member access to team prompts', () => {
		expect(checkAccessToPrompt({ ...basePrompt, privacyLevel: 'team' }, otherUser)).toBeUndefined();
	});

	it('denies non-team-member access to team prompts', () => {
		expect(checkAccessToPrompt({ ...basePrompt, privacyLevel: 'team' }, noOrgUser)).toBe(
			'FORBIDDEN'
		);
	});
});

// ---------------------------------------------------------------------------
// Handler tests
// ---------------------------------------------------------------------------

describe('getPublicPromptsHandler', () => {
	it('returns public prompts', async () => {
		const mockPrompts = [
			{ promptId: 'p1', title: 'Test', privacyLevel: 'public', createdAt: new Date() },
		];
		const db = {
			select: () => ({
				from: () => ({
					where: () => ({
						orderBy: () => ({
							limit: () => Promise.resolve(mockPrompts),
						}),
					}),
				}),
			}),
		};
		const result = await Effect.runPromise(
			getPublicPromptsHandler.pipe(Effect.provide(makeDbLayer(db)))
		);
		expect(result).toEqual([{ promptId: 'p1', title: 'Test', isPublic: true }]);
	});
});

describe('createPromptHandler', () => {
	it('creates a prompt and returns promptId', async () => {
		const insertCalls: unknown[][] = [];
		const db = {
			insert: (table: unknown) => ({
				values: (vals: unknown) => {
					insertCalls.push([table, vals]);
					return Promise.resolve();
				},
			}),
		};
		const result = await Effect.runPromise(
			createPromptHandler('u1', 'org-1', {
				title: 'My Prompt',
				tags: ['tag1'],
				template: [{ role: 'user' as const, content: 'Hello' }],
				privacyLevel: 'public',
			}).pipe(Effect.provide(makeDbLayer(db)))
		);
		expect(typeof result).toBe('string');
		expect(result.length).toBeGreaterThan(0);
		expect(insertCalls).toHaveLength(2);
	});
});

describe('deletePromptHandler', () => {
	it('deletes own prompt', async () => {
		const db = {
			select: () => ({
				from: () => ({
					where: () => Promise.resolve([{ userId: 'u1' }]),
				}),
			}),
			delete: () => ({
				where: () => Promise.resolve(),
			}),
		};
		const result = await Effect.runPromise(
			deletePromptHandler('u1', { promptId: 'p1' }).pipe(Effect.provide(makeDbLayer(db)))
		);
		expect(result.promptId).toBe('p1');
	});

	it('fails with NotFound for missing prompt', async () => {
		const db = {
			select: () => ({
				from: () => ({
					where: () => Promise.resolve([]),
				}),
			}),
		};
		const exit = await Effect.runPromiseExit(
			deletePromptHandler('u1', { promptId: 'p999' }).pipe(Effect.provide(makeDbLayer(db)))
		);
		expect(Exit.isFailure(exit)).toBe(true);
	});

	it('fails with Forbidden for another user prompt', async () => {
		const db = {
			select: () => ({
				from: () => ({
					where: () => Promise.resolve([{ userId: 'other-user' }]),
				}),
			}),
		};
		const exit = await Effect.runPromiseExit(
			deletePromptHandler('u1', { promptId: 'p1' }).pipe(Effect.provide(makeDbLayer(db)))
		);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			expect(exit.cause.toString()).toContain('Forbidden');
		}
	});
});

describe('likePromptHandler', () => {
	it('inserts a like', async () => {
		let inserted = false;
		const db = {
			insert: () => ({
				values: () => ({
					onConflictDoNothing: () => {
						inserted = true;
						return Promise.resolve();
					},
				}),
			}),
		};
		const result = await Effect.runPromise(
			likePromptHandler('u1', { promptId: 'p1' }).pipe(Effect.provide(makeDbLayer(db)))
		);
		expect(result.promptId).toBe('p1');
		expect(inserted).toBe(true);
	});

	it('deletes a like on unlike', async () => {
		let deleted = false;
		const db = {
			delete: () => ({
				where: () => {
					deleted = true;
					return Promise.resolve();
				},
			}),
		};
		const result = await Effect.runPromise(
			likePromptHandler('u1', { promptId: 'p1', unlike: true }).pipe(
				Effect.provide(makeDbLayer(db))
			)
		);
		expect(result.promptId).toBe('p1');
		expect(deleted).toBe(true);
	});
});
