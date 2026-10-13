import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { type ActionContext, actionErrorMessage } from '../actions/define-action';
import { actions, type AnyAction } from '../actions/registry';
import {
	authenticateMcpRequest,
	type McpApiTokenConfig,
	McpAuthError,
	readMcpApiTokenConfig,
} from './auth';

const SERVER_NAME = 'prompts-with-friends';
const SERVER_VERSION = '0.0.1';

export async function handleMcpHttp(
	request: Request,
	options?: { apiToken?: McpApiTokenConfig }
): Promise<Response> {
	if (request.method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: corsHeaders(request) });
	}

	try {
		const ctx = await authenticateMcpRequest(request, options?.apiToken ?? readMcpApiTokenConfig());
		const response = await dispatchMcp(request, ctx);
		return withCors(response, request);
	} catch (error) {
		if (error instanceof McpAuthError) {
			return json(
				error.status,
				{ error: authErrorName(error.status), message: error.message },
				request,
				error.status === 401 ? { 'www-authenticate': 'Bearer realm="mcp"' } : undefined
			);
		}
		console.error('MCP request failed', error);
		return json(500, { error: 'internal_error', message: 'MCP request failed.' }, request);
	}
}

async function dispatchMcp(
	request: Request,
	ctx: Awaited<ReturnType<typeof authenticateMcpRequest>>
): Promise<Response> {
	const server = new McpServer(
		{ name: SERVER_NAME, version: SERVER_VERSION },
		{
			instructions:
				'Tools for Prompts with Friends. list-prompts and get-prompt read prompts. create-prompt adds one in the active organization. The signed-in user and organization come from the MCP credential.',
		}
	);

	for (const action of actions) {
		registerAction(server, action, ctx);
	}

	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});
	await server.connect(transport);
	return transport.handleRequest(request);
}

function registerAction(server: McpServer, action: AnyAction, ctx: ActionContext) {
	server.registerTool(
		action.name,
		{
			description: action.description,
			inputSchema: action.schema.shape,
			annotations: {
				readOnlyHint: action.readOnly,
				destructiveHint: false,
				idempotentHint: action.readOnly,
				openWorldHint: false,
			},
		},
		async (args) => {
			try {
				const result = await action.run(args, ctx);
				return {
					content: [{ type: 'text' as const, text: JSON.stringify(result) }],
				};
			} catch (error) {
				const message = actionErrorMessage(error);
				if (!message) console.error(`Action ${action.name} failed`, error);
				return {
					isError: true,
					content: [{ type: 'text' as const, text: message ?? 'Action failed.' }],
				};
			}
		}
	);
}

function authErrorName(status: number) {
	if (status === 401) return 'unauthorized';
	if (status === 403) return 'forbidden';
	return 'bad_request';
}

function json(
	status: number,
	body: unknown,
	request: Request,
	extra?: Record<string, string>
): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'content-type': 'application/json',
			...corsHeaders(request),
			...extra,
		},
	});
}

function withCors(response: Response, request: Request): Response {
	const headers = new Headers(response.headers);
	for (const [key, value] of Object.entries(corsHeaders(request))) {
		headers.set(key, value);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function corsHeaders(request: Request): Record<string, string> {
	const origin = request.headers.get('origin');
	return {
		...(origin ? { 'access-control-allow-origin': origin, vary: 'origin' } : {}),
		'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
		'access-control-allow-headers':
			'authorization, content-type, mcp-protocol-version, mcp-session-id, x-org-id',
	};
}
