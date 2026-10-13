import { afterAll, describe, expect, it } from 'vitest';

import { sql } from '../../db/db';
import { fakeUser, mockValidateAccessTokenAndGetUser } from '../trpc/routers/test-utils';
import { handleMcpHttp } from './handle-mcp';

const apiToken = {
	token: 'service-token',
	userId: 'service-user',
	orgId: 'service-org',
};

function rpc(method: string, params?: unknown, id: number | null = 1) {
	return new Request('http://localhost:3000/mcp', {
		method: 'POST',
		headers: {
			authorization: 'Bearer service-token',
			accept: 'application/json, text/event-stream',
			'content-type': 'application/json',
		},
		body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
	});
}

function toolText(body: { result?: Record<string, unknown> }) {
	const content = body.result?.content as { text: string }[] | undefined;
	const structured = body.result?.structuredContent;
	if (content?.[0]?.text) return content[0].text;
	return JSON.stringify(structured ?? body);
}

async function readBody(response: Response) {
	const text = await response.text();
	if (text.startsWith('event:') || text.startsWith('data:')) {
		const data = text
			.split('\n')
			.filter((line) => line.startsWith('data:'))
			.map((line) => line.slice(5).trim())
			.join('\n');
		return JSON.parse(data) as { result?: Record<string, unknown>; error?: { message: string } };
	}
	return JSON.parse(text) as { result?: Record<string, unknown>; error?: { message: string } };
}

const createdPromptIds: string[] = [];

afterAll(async () => {
	if (createdPromptIds.length > 0) {
		await sql`DELETE FROM prompt_likes WHERE prompt_id = ANY(${createdPromptIds})`;
		await sql`DELETE FROM prompts WHERE id = ANY(${createdPromptIds})`;
	}
});

describe('/mcp', () => {
	it('returns 401 without a credential', async () => {
		const response = await handleMcpHttp(
			new Request('http://localhost:3000/mcp', { method: 'POST' }),
			{ apiToken: {} }
		);
		expect(response.status).toBe(401);
		expect(response.headers.get('www-authenticate')).toContain('Bearer');
	});

	it('answers initialize and lists the prompt tools', async () => {
		const initialized = await handleMcpHttp(
			rpc('initialize', {
				protocolVersion: '2025-03-26',
				capabilities: {},
				clientInfo: { name: 'vitest', version: '0.0.0' },
			}),
			{ apiToken }
		);
		expect(initialized.status).toBe(200);
		const initBody = await readBody(initialized);
		expect(initBody.result?.serverInfo).toMatchObject({ name: 'prompts-with-friends' });

		const listed = await handleMcpHttp(rpc('tools/list', {}), { apiToken });
		expect(listed.status).toBe(200);
		const listBody = await readBody(listed);
		const tools = listBody.result?.tools as {
			name: string;
			annotations?: { readOnlyHint?: boolean };
		}[];
		expect(tools.map((tool) => tool.name).sort()).toEqual([
			'create-prompt',
			'get-prompt',
			'list-prompts',
		]);
		const listPrompts = tools.find((tool) => tool.name === 'list-prompts');
		expect(listPrompts?.annotations?.readOnlyHint).toBe(true);
	});

	it('rejects an invalid create-prompt call before writing', async () => {
		const response = await handleMcpHttp(
			rpc('tools/call', { name: 'create-prompt', arguments: { title: 'Missing the rest' } }),
			{ apiToken }
		);
		expect(response.status).toBe(200);
		const body = await readBody(response);
		const text = JSON.stringify(body);
		expect(text).toMatch(/privacyLevel|invalid|required/i);
	});

	it('creates and reads a prompt through the shared actions', async () => {
		const created = await handleMcpHttp(
			rpc('tools/call', {
				name: 'create-prompt',
				arguments: {
					title: 'MCP Prompt',
					description: 'from the tool',
					tags: ['mcp', ' '],
					template: [{ role: 'user', content: 'Hello' }],
					privacyLevel: 'private',
				},
			}),
			{ apiToken }
		);
		expect(created.status).toBe(200);
		const createdBody = await readBody(created);
		const createdText = toolText(createdBody);
		const promptId = JSON.parse(createdText) as string;
		expect(promptId.length).toBeGreaterThan(0);
		createdPromptIds.push(promptId);

		const listed = await handleMcpHttp(rpc('tools/call', { name: 'list-prompts', arguments: {} }), {
			apiToken,
		});
		expect(listed.status).toBe(200);
		const listedBody = await readBody(listed);
		const prompts = JSON.parse(toolText(listedBody)) as { promptId: string; title: string }[];
		expect(prompts).toContainEqual(expect.objectContaining({ promptId, title: 'MCP Prompt' }));

		const fetched = await handleMcpHttp(
			rpc('tools/call', { name: 'get-prompt', arguments: { promptId } }),
			{ apiToken }
		);
		expect(fetched.status).toBe(200);
		const fetchedBody = await readBody(fetched);
		const prompt = JSON.parse(toolText(fetchedBody)) as {
			canEdit: boolean;
			prompt: { title: string; tags: string[]; privacyLevel: string };
		};
		expect(prompt.canEdit).toBe(true);
		expect(prompt.prompt.title).toBe('MCP Prompt');
		expect(prompt.prompt.tags).toEqual(['mcp']);
		expect(prompt.prompt.privacyLevel).toBe('private');
	});

	it('serves tools for a PropelAuth bearer token', async () => {
		mockValidateAccessTokenAndGetUser.mockResolvedValue(
			fakeUser({ userId: 'user-1', orgId: 'org-1' })
		);
		const request = rpc('tools/list', {});
		request.headers.set('authorization', 'Bearer propel-access');
		const response = await handleMcpHttp(request, { apiToken: {} });
		expect(response.status).toBe(200);
		const body = await readBody(response);
		expect(JSON.stringify(body)).toContain('list-prompts');
	});
});
