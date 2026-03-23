import './test-utils';

import { afterAll, describe, expect, it } from 'vitest';

import { sql } from '../../../db/db';
import { createCaller } from '../root';

const caller = createCaller({});

const createdIds: number[] = [];

afterAll(async () => {
	if (createdIds.length > 0) {
		await sql`DELETE FROM surveys WHERE id = ANY(${createdIds})`;
	}
	await sql.end();
});

describe('surveys router', () => {
	it('postSurvey creates a survey and getPublic returns it', async () => {
		const id = await caller.surveys.postSurvey({
			rating: 5,
			is_public: 'on',
			comments: 'vitest integration test',
		});
		createdIds.push(id);

		expect(id).toBeTypeOf('number');

		const publicSurveys = await caller.surveys.getPublic();
		const found = publicSurveys.find((s) => s.id === id);

		expect(found).toBeDefined();
		expect(found?.rating).toBe(5);
		expect(found?.comments).toBe('vitest integration test');
	});

	it('postSurvey with missing optional fields (no comments, no is_public)', async () => {
		const id = await caller.surveys.postSurvey({
			rating: 3,
		});
		createdIds.push(id);

		expect(id).toBeTypeOf('number');

		// Without is_public: 'on', survey should NOT appear in getPublic
		const publicSurveys = await caller.surveys.getPublic();
		const found = publicSurveys.find((s) => s.id === id);
		expect(found).toBeUndefined();
	});

	it('postSurvey accepts rating boundary value 1 (minimum)', async () => {
		const id = await caller.surveys.postSurvey({
			rating: 1,
			is_public: 'on',
			comments: 'minimum rating test',
		});
		createdIds.push(id);

		const publicSurveys = await caller.surveys.getPublic();
		const found = publicSurveys.find((s) => s.id === id);
		expect(found).toBeDefined();
		expect(found?.rating).toBe(1);
	});

	it('postSurvey accepts rating boundary value 5 (maximum)', async () => {
		const id = await caller.surveys.postSurvey({
			rating: 5,
			is_public: 'on',
			comments: 'maximum rating test',
		});
		createdIds.push(id);

		const publicSurveys = await caller.surveys.getPublic();
		const found = publicSurveys.find((s) => s.id === id);
		expect(found).toBeDefined();
		expect(found?.rating).toBe(5);
	});

	it('postSurvey rejects rating below 1', async () => {
		await expect(caller.surveys.postSurvey({ rating: 0, is_public: 'on' })).rejects.toThrow();
	});

	it('postSurvey rejects rating above 5', async () => {
		await expect(caller.surveys.postSurvey({ rating: 6, is_public: 'on' })).rejects.toThrow();
	});

	it('private surveys are excluded from getPublic', async () => {
		const privateId = await caller.surveys.postSurvey({
			rating: 4,
			// is_public omitted → defaults to false
			comments: 'private survey test',
		});
		createdIds.push(privateId);

		const publicSurveys = await caller.surveys.getPublic();
		const found = publicSurveys.find((s) => s.id === privateId);
		expect(found).toBeUndefined();
	});

	it('getPublic returns surveys ordered by id descending', async () => {
		const id1 = await caller.surveys.postSurvey({
			rating: 2,
			is_public: 'on',
			comments: 'ordering test 1',
		});
		createdIds.push(id1);

		const id2 = await caller.surveys.postSurvey({
			rating: 4,
			is_public: 'on',
			comments: 'ordering test 2',
		});
		createdIds.push(id2);

		const publicSurveys = await caller.surveys.getPublic();
		const idx1 = publicSurveys.findIndex((s) => s.id === id1);
		const idx2 = publicSurveys.findIndex((s) => s.id === id2);

		// id2 was created later so should appear first (desc order)
		expect(idx2).toBeLessThan(idx1);
	});
});
