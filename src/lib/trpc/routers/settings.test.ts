import { afterAll, describe, expect, it } from 'vitest';

import { sql } from '../../../db/db';
import { createCaller } from '../root';
import { fakeAuthContext, fakeUser } from './test-utils';

const TEST_ORG_ID = 'test-org-settings';
const testUser = fakeUser({ userId: 'test-user-settings', orgId: TEST_ORG_ID });

function authedCaller(user = testUser, orgId = TEST_ORG_ID) {
	return createCaller(fakeAuthContext(user, orgId));
}

const createdKeyIds: number[] = [];

afterAll(async () => {
	if (createdKeyIds.length > 0) {
		await sql`DELETE FROM gpt_keys WHERE id = ANY(${createdKeyIds})`;
	}
	await sql.end();
});

describe('settings router', () => {
	describe('stripeConfigured', () => {
		it('returns a boolean', async () => {
			const caller = authedCaller();
			const result = await caller.settings.stripeConfigured({ orgId: TEST_ORG_ID });
			expect(result).toBeTypeOf('boolean');
		});
	});

	describe('getKeys', () => {
		it('returns empty array when no keys exist for org', async () => {
			const caller = authedCaller();
			const keys = await caller.settings.getKeys({ orgId: TEST_ORG_ID });
			expect(keys).toEqual([]);
		});
	});

	describe('createKey / deleteKey', () => {
		it('createKey stores a key and getKeys returns it', async () => {
			const caller = authedCaller();
			const keyId = await caller.settings.createKey({
				orgId: TEST_ORG_ID,
				keySecret: 'sk-test-1234567890abcdef',
				keyType: 'gpt-3',
			});
			createdKeyIds.push(keyId);

			expect(keyId).toBeTypeOf('number');

			const keys = await caller.settings.getKeys({ orgId: TEST_ORG_ID });
			const found = keys.find((k) => k.keyId === keyId);
			expect(found).toBeDefined();
			expect(found?.keyType).toBe('gpt-3');
			expect(found?.keyPublic).toBe('sk-...cdef');
		});

		it('createKey replaces existing key for the same org', async () => {
			const caller = authedCaller();

			// Create first key
			const _keyId1 = await caller.settings.createKey({
				orgId: TEST_ORG_ID,
				keySecret: 'sk-first-key-abcdef1234',
				keyType: 'gpt-3',
			});

			// Create second key (should replace first)
			const keyId2 = await caller.settings.createKey({
				orgId: TEST_ORG_ID,
				keySecret: 'sk-second-key-zyxwvut9876',
				keyType: 'gpt-4',
			});
			createdKeyIds.push(keyId2);

			const keys = await caller.settings.getKeys({ orgId: TEST_ORG_ID });
			// Only the second key should exist
			expect(keys).toHaveLength(1);
			expect(keys[0]?.keyType).toBe('gpt-4');
		});

		it('deleteKey removes a key', async () => {
			const caller = authedCaller();
			const keyId = await caller.settings.createKey({
				orgId: TEST_ORG_ID,
				keySecret: 'sk-delete-me-abcdef1234',
				keyType: 'gpt-3',
			});
			// Don't track — we're deleting it

			await caller.settings.deleteKey({ keyId });

			const keys = await caller.settings.getKeys({ orgId: TEST_ORG_ID });
			const found = keys.find((k) => k.keyId === keyId);
			expect(found).toBeUndefined();
		});

		it('deleteKey rejects deletion by non-owner', async () => {
			const caller = authedCaller();
			const keyId = await caller.settings.createKey({
				orgId: TEST_ORG_ID,
				keySecret: 'sk-not-yours-abcdef1234',
				keyType: 'gpt-3',
			});
			createdKeyIds.push(keyId);

			const otherUser = fakeUser({ userId: 'other-user-settings', orgId: TEST_ORG_ID });
			const otherCaller = authedCaller(otherUser);
			await expect(otherCaller.settings.deleteKey({ keyId })).rejects.toThrow(/your own keys/i);
		});
	});
});
