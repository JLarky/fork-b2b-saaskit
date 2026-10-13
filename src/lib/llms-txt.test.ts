import { describe, expect, it } from 'vitest';

import { buildLlmsTxt, renderLlmsTxt } from './llms-txt';

describe('llms.txt', () => {
	it('lists pages, the MCP endpoint, and the supplied tools', () => {
		const text = buildLlmsTxt({
			siteUrl: 'https://prompts.example/',
			siteName: 'Prompts with Friends',
			description: 'Collaborate on prompts.',
			actions: [
				{ name: 'list-prompts', description: 'List them.', readOnly: true },
				{ name: 'create-prompt', description: 'Create one.', readOnly: false },
			],
		});

		expect(text.startsWith('# Prompts with Friends\n')).toBe(true);
		expect(text).toContain('> Collaborate on prompts.');
		expect(text).toContain('[MCP endpoint](https://prompts.example/mcp)');
		expect(text).toContain('`list-prompts` (read): List them.');
		expect(text).toContain('`create-prompt` (write): Create one.');
		expect(text).toContain('[App](https://prompts.example/app)');
	});

	it('is generated from the registered prompt actions', () => {
		const text = renderLlmsTxt('http://localhost:3000');
		expect(text).toContain('`list-prompts` (read)');
		expect(text).toContain('`get-prompt` (read)');
		expect(text).toContain('`create-prompt` (write)');
		expect(text).toContain('http://localhost:3000/mcp');
	});
});
