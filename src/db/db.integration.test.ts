import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { surveys } from './schema';
import { createTestDatabase } from './test-utils';

describe('database (PGlite in-process Postgres)', () => {
	let ctx: Awaited<ReturnType<typeof createTestDatabase>>;

	beforeAll(async () => {
		ctx = await createTestDatabase();
	});

	afterAll(async () => {
		await ctx?.close();
	});

	it('applies schema so surveys can be written and read', async () => {
		const [row] = await ctx.db
			.insert(surveys)
			.values({ rating: 4, isPublic: false, comments: 'integration' })
			.returning();

		expect(row?.rating).toBe(4);
		expect(row?.comments).toBe('integration');

		const found = await ctx.db.select().from(surveys).where(eq(surveys.id, row!.id));
		expect(found).toHaveLength(1);
		expect(found[0]?.rating).toBe(4);
	});
});
