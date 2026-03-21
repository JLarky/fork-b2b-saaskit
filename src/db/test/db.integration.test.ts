import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { gptKeys, promptLikes, prompts, sharedKeyRatelimit, surveys } from '../schema';

import { createTestDb, migrateTestDb, teardown } from './setup';

let db: PostgresJsDatabase;
let sql: ReturnType<typeof postgres>;

beforeAll(async () => {
	({ db, sql } = createTestDb());
	await migrateTestDb(sql, db);
}, 30_000);

afterAll(async () => {
	await teardown(sql);
});

describe('prompts table', () => {
	const testPrompt = {
		promptId: 'test-prompt-1',
		userId: 'user-1',
		orgId: 'org-1',
		template: { text: 'Hello {{name}}' },
		title: 'Greeting',
		description: 'A greeting prompt',
		tags: ['hello', 'greet'],
		privacyLevel: 'public',
	};

	it('inserts and reads a prompt', async () => {
		await db.insert(prompts).values(testPrompt);
		const rows = await db.select().from(prompts).where(eq(prompts.promptId, 'test-prompt-1'));
		expect(rows).toHaveLength(1);
		expect(rows[0].title).toBe('Greeting');
		expect(rows[0].template).toEqual({ text: 'Hello {{name}}' });
	});

	it('updates a prompt', async () => {
		await db
			.update(prompts)
			.set({ title: 'Updated Greeting' })
			.where(eq(prompts.promptId, 'test-prompt-1'));
		const [row] = await db.select().from(prompts).where(eq(prompts.promptId, 'test-prompt-1'));
		expect(row.title).toBe('Updated Greeting');
	});

	it('deletes a prompt', async () => {
		await db.delete(prompts).where(eq(prompts.promptId, 'test-prompt-1'));
		const rows = await db.select().from(prompts).where(eq(prompts.promptId, 'test-prompt-1'));
		expect(rows).toHaveLength(0);
	});
});

describe('prompt_likes table', () => {
	beforeAll(async () => {
		await db.insert(prompts).values({
			promptId: 'liked-prompt',
			userId: 'user-1',
			orgId: 'org-1',
			template: {},
			title: 'Likeable',
			tags: [],
			privacyLevel: 'public',
		});
	});

	afterAll(async () => {
		await db.delete(promptLikes).where(eq(promptLikes.promptId, 'liked-prompt'));
		await db.delete(prompts).where(eq(prompts.promptId, 'liked-prompt'));
	});

	it('inserts and reads a like', async () => {
		await db.insert(promptLikes).values({ promptId: 'liked-prompt', userId: 'user-2' });
		const rows = await db
			.select()
			.from(promptLikes)
			.where(eq(promptLikes.promptId, 'liked-prompt'));
		expect(rows).toHaveLength(1);
		expect(rows[0].userId).toBe('user-2');
	});

	it('enforces composite primary key', async () => {
		await expect(
			db.insert(promptLikes).values({ promptId: 'liked-prompt', userId: 'user-2' })
		).rejects.toThrow();
	});
});

describe('surveys table', () => {
	it('inserts with defaults and reads back', async () => {
		const [row] = await db.insert(surveys).values({ rating: 5 }).returning();
		expect(row.rating).toBe(5);
		expect(row.isPublic).toBe(false);
		expect(row.comments).toBeNull();
		expect(row.createdAt).toBeInstanceOf(Date);

		await db.delete(surveys).where(eq(surveys.id, row.id));
	});
});

describe('gpt_keys table', () => {
	it('inserts and reads a key', async () => {
		const [row] = await db
			.insert(gptKeys)
			.values({
				keyPublic: 'pk_test',
				keySecret: 'sk_test',
				keyType: 'gpt-4',
				userId: 'user-1',
				orgId: 'org-1',
			})
			.returning();
		expect(row.keyType).toBe('gpt-4');
		expect(row.isShared).toBe(false);

		await db.delete(gptKeys).where(eq(gptKeys.keyId, row.keyId));
	});
});

describe('shared_key_ratelimit table', () => {
	it('inserts and reads a ratelimit entry', async () => {
		await db
			.insert(sharedKeyRatelimit)
			.values({ limitId: 'rl-test-1', value: 100 });
		const [row] = await db
			.select()
			.from(sharedKeyRatelimit)
			.where(eq(sharedKeyRatelimit.limitId, 'rl-test-1'));
		expect(row.value).toBe(100);

		await db.delete(sharedKeyRatelimit).where(eq(sharedKeyRatelimit.limitId, 'rl-test-1'));
	});
});
