import { describe, expect, it } from 'vitest';

import { createCaller } from '../root';

const caller = createCaller({});

describe('hello router', () => {
	describe('getCount / increment', () => {
		it('getCount returns the current counter value', async () => {
			const count = await caller.hello.getCount();
			expect(count).toBeTypeOf('number');
		});

		it('increment increases the counter by 1', async () => {
			const before = await caller.hello.getCount();
			const result = await caller.hello.increment();
			expect(result).toBe(before + 1);
		});

		it('multiple increments accumulate', async () => {
			const before = await caller.hello.getCount();
			await caller.hello.increment();
			await caller.hello.increment();
			await caller.hello.increment();
			const after = await caller.hello.getCount();
			expect(after).toBe(before + 3);
		});
	});
});
