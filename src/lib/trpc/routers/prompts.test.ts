import { afterAll, describe, expect, it } from 'vitest';

import { sql } from '../../../db/db';
import { createCaller } from '../root';
import { fakeAuthContext, fakeUser } from './test-utils';

const TEST_ORG_ID = 'test-org-prompts';
const testUser = fakeUser({ userId: 'test-user-prompts', orgId: TEST_ORG_ID });
const otherUser = fakeUser({ userId: 'other-user-prompts', orgId: TEST_ORG_ID });

function authedCaller(user = testUser, orgId = TEST_ORG_ID) {
	return createCaller(fakeAuthContext(user, orgId));
}

const createdPromptIds: string[] = [];

afterAll(async () => {
	if (createdPromptIds.length > 0) {
		await sql`DELETE FROM prompt_likes WHERE prompt_id = ANY(${createdPromptIds})`;
		await sql`DELETE FROM prompts WHERE id = ANY(${createdPromptIds})`;
	}
	await sql.end();
});

describe('prompts router', () => {
	describe('CRUD', () => {
		it('createPrompt returns a prompt id', async () => {
			const caller = authedCaller();
			const promptId = await caller.prompts.createPrompt({
				orgId: TEST_ORG_ID,
				title: 'Test Prompt',
				description: 'A test prompt',
				tags: ['test', 'integration'],
				template: [{ role: 'user', content: 'Hello {{name||world}}' }],
				privacyLevel: 'public',
			});

			createdPromptIds.push(promptId);
			expect(promptId).toBeTypeOf('string');
			expect(promptId.length).toBeGreaterThan(0);
		});

		it('getPrompt retrieves a created prompt', async () => {
			const caller = authedCaller();
			const promptId = await caller.prompts.createPrompt({
				orgId: TEST_ORG_ID,
				title: 'Readable Prompt',
				description: 'Should be readable',
				tags: ['read-test'],
				template: [{ role: 'system', content: 'You are helpful.' }],
				privacyLevel: 'public',
			});
			createdPromptIds.push(promptId);

			const result = await caller.prompts.getPrompt({ promptId });

			expect(result.prompt.title).toBe('Readable Prompt');
			expect(result.prompt.description).toBe('Should be readable');
			expect(result.prompt.tags).toEqual(['read-test']);
			expect(result.prompt.template).toEqual([{ role: 'system', content: 'You are helpful.' }]);
			expect(result.canEdit).toBe(true);
		});

		it('updatePrompt modifies an existing prompt', async () => {
			const caller = authedCaller();
			const promptId = await caller.prompts.createPrompt({
				orgId: TEST_ORG_ID,
				title: 'Before Update',
				description: 'original',
				tags: [],
				template: [{ role: 'user', content: 'original' }],
				privacyLevel: 'public',
			});
			createdPromptIds.push(promptId);

			await caller.prompts.updatePrompt({
				orgId: TEST_ORG_ID,
				promptId,
				title: 'After Update',
				description: 'modified',
				tags: ['updated'],
				template: [{ role: 'user', content: 'modified' }],
				privacyLevel: 'team',
			});

			const result = await caller.prompts.getPrompt({ promptId });
			expect(result.prompt.title).toBe('After Update');
			expect(result.prompt.description).toBe('modified');
			expect(result.prompt.tags).toEqual(['updated']);
		});

		it('updatePrompt rejects updates from non-owner', async () => {
			const ownerCaller = authedCaller();
			const promptId = await ownerCaller.prompts.createPrompt({
				orgId: TEST_ORG_ID,
				title: 'Owner Only',
				description: '',
				tags: [],
				template: [{ role: 'user', content: 'test' }],
				privacyLevel: 'public',
			});
			createdPromptIds.push(promptId);

			const otherCaller = authedCaller(otherUser);
			await expect(
				otherCaller.prompts.updatePrompt({
					orgId: TEST_ORG_ID,
					promptId,
					title: 'Hijacked',
					description: '',
					tags: [],
					template: [{ role: 'user', content: 'test' }],
					privacyLevel: 'public',
				})
			).rejects.toThrow(/your own prompts/i);
		});

		it('deletePrompt removes a prompt', async () => {
			const caller = authedCaller();
			const promptId = await caller.prompts.createPrompt({
				orgId: TEST_ORG_ID,
				title: 'To Delete',
				description: '',
				tags: [],
				template: [{ role: 'user', content: 'delete me' }],
				privacyLevel: 'public',
			});
			// Don't track — we're deleting it

			await caller.prompts.deletePrompt({ promptId });

			await expect(caller.prompts.getPrompt({ promptId })).rejects.toThrow(/not found/i);
		});

		it('deletePrompt rejects deletion from non-owner', async () => {
			const ownerCaller = authedCaller();
			const promptId = await ownerCaller.prompts.createPrompt({
				orgId: TEST_ORG_ID,
				title: 'Not Yours',
				description: '',
				tags: [],
				template: [{ role: 'user', content: 'test' }],
				privacyLevel: 'public',
			});
			createdPromptIds.push(promptId);

			const otherCaller = authedCaller(otherUser);
			await expect(otherCaller.prompts.deletePrompt({ promptId })).rejects.toThrow(
				/your own prompts/i
			);
		});
	});

	describe('createPrompt defaults', () => {
		it('uses "Untitled" when title is empty', async () => {
			const caller = authedCaller();
			const promptId = await caller.prompts.createPrompt({
				orgId: TEST_ORG_ID,
				title: '',
				description: '',
				tags: [],
				template: [{ role: 'user', content: 'test' }],
				privacyLevel: 'public',
			});
			createdPromptIds.push(promptId);

			const result = await caller.prompts.getPrompt({ promptId });
			expect(result.prompt.title).toBe('Untitled');
		});

		it('trims whitespace-only tags', async () => {
			const caller = authedCaller();
			const promptId = await caller.prompts.createPrompt({
				orgId: TEST_ORG_ID,
				title: 'Tag Test',
				description: '',
				tags: ['valid', '  ', '', ' also-valid '],
				template: [{ role: 'user', content: 'test' }],
				privacyLevel: 'public',
			});
			createdPromptIds.push(promptId);

			const result = await caller.prompts.getPrompt({ promptId });
			expect(result.prompt.tags).toEqual(['valid', 'also-valid']);
		});
	});

	describe('like / unlike', () => {
		it('createPrompt auto-likes for the creator', async () => {
			const caller = authedCaller();
			const promptId = await caller.prompts.createPrompt({
				orgId: TEST_ORG_ID,
				title: 'Auto Like',
				description: '',
				tags: [],
				template: [{ role: 'user', content: 'test' }],
				privacyLevel: 'public',
			});
			createdPromptIds.push(promptId);

			const result = await caller.prompts.getPrompt({ promptId });
			expect(result.likes).toBe(1);
			expect(result.myLike).toBe(true);
		});

		it('likePrompt adds a like from another user', async () => {
			const ownerCaller = authedCaller();
			const promptId = await ownerCaller.prompts.createPrompt({
				orgId: TEST_ORG_ID,
				title: 'Likeable',
				description: '',
				tags: [],
				template: [{ role: 'user', content: 'test' }],
				privacyLevel: 'public',
			});
			createdPromptIds.push(promptId);

			// Another user likes it
			const otherCaller = authedCaller(otherUser);
			await otherCaller.prompts.likePrompt({ promptId });

			// Check via owner's view
			const result = await ownerCaller.prompts.getPrompt({ promptId });
			expect(result.likes).toBe(2); // creator auto-like + other user
		});

		it('unlike removes a like', async () => {
			const caller = authedCaller();
			const promptId = await caller.prompts.createPrompt({
				orgId: TEST_ORG_ID,
				title: 'Unlike Test',
				description: '',
				tags: [],
				template: [{ role: 'user', content: 'test' }],
				privacyLevel: 'public',
			});
			createdPromptIds.push(promptId);

			// Unlike the auto-like
			await caller.prompts.likePrompt({ promptId, unlike: true });

			const result = await caller.prompts.getPrompt({ promptId });
			expect(result.likes).toBe(0);
			expect(result.myLike).toBe(false);
		});

		it('liking twice is idempotent (onConflictDoNothing)', async () => {
			const caller = authedCaller();
			const promptId = await caller.prompts.createPrompt({
				orgId: TEST_ORG_ID,
				title: 'Double Like',
				description: '',
				tags: [],
				template: [{ role: 'user', content: 'test' }],
				privacyLevel: 'public',
			});
			createdPromptIds.push(promptId);

			// Already auto-liked by creator; like again
			await caller.prompts.likePrompt({ promptId });
			await caller.prompts.likePrompt({ promptId });

			const result = await caller.prompts.getPrompt({ promptId });
			expect(result.likes).toBe(1); // still just 1
		});
	});

	describe('privacy levels', () => {
		it('public prompts appear in getPublicPrompts', async () => {
			const caller = authedCaller();
			const promptId = await caller.prompts.createPrompt({
				orgId: TEST_ORG_ID,
				title: 'Public Prompt',
				description: '',
				tags: [],
				template: [{ role: 'user', content: 'test' }],
				privacyLevel: 'public',
			});
			createdPromptIds.push(promptId);

			const unauthCaller = createCaller({});
			const publicPrompts = await unauthCaller.prompts.getPublicPrompts();
			const found = publicPrompts.find((p) => p.promptId === promptId);
			expect(found).toBeDefined();
			expect(found?.title).toBe('Public Prompt');
		});

		it('private prompts do NOT appear in getPublicPrompts', async () => {
			const caller = authedCaller();
			const promptId = await caller.prompts.createPrompt({
				orgId: TEST_ORG_ID,
				title: 'Private Prompt',
				description: '',
				tags: [],
				template: [{ role: 'user', content: 'secret' }],
				privacyLevel: 'private',
			});
			createdPromptIds.push(promptId);

			const unauthCaller = createCaller({});
			const publicPrompts = await unauthCaller.prompts.getPublicPrompts();
			const found = publicPrompts.find((p) => p.promptId === promptId);
			expect(found).toBeUndefined();
		});
	});
});
