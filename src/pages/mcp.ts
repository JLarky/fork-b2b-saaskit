import type { APIRoute } from 'astro';

import { handleMcpHttp } from '../lib/mcp/handle-mcp';

export const prerender = false;

/** Streamable HTTP MCP. One stateless request per call; auth is per user and org. */
export const ALL: APIRoute = ({ request }) => handleMcpHttp(request);
