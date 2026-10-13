import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ActionError, defineAction } from './define-action';

const ctx = { user: undefined, orgId: undefined, origin: 'http://localhost:3000' };

describe('defineAction', () => {
	it('validates input once and returns the run result', async () => {
		const greet = defineAction({
			name: 'greet',
			description: 'Say hello.',
			schema: z.object({
				name: z.string().min(1),
			}),
			readOnly: true,
			run: async (input) => ({ message: `Hello, ${input.name}` }),
		});

		await expect(greet.run({ name: 'Ada' }, ctx)).resolves.toEqual({ message: 'Hello, Ada' });
		await expect(greet.run({}, ctx)).rejects.toThrow(/name/i);
	});

	it('treats a missing payload as an empty object', async () => {
		const ping = defineAction({
			name: 'ping',
			description: 'No arguments.',
			schema: z.object({}),
			readOnly: true,
			run: async () => ({ ok: true }),
		});

		await expect(ping.run(undefined, ctx)).resolves.toEqual({ ok: true });
	});

	it('rejects a name that is not kebab-case', () => {
		expect(() =>
			defineAction({
				name: 'ListPrompts',
				description: 'Bad name.',
				schema: z.object({}),
				run: async () => null,
			})
		).toThrow(/kebab-case/);
	});

	it('exposes ActionError codes for callers to map', () => {
		const error = new ActionError('NOT_FOUND', 'Prompt missing');
		expect(error.code).toBe('NOT_FOUND');
		expect(error.message).toBe('Prompt missing');
	});
});
