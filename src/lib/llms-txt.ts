import { websiteDescription, websiteTitle } from '../constants';
import { actions } from './actions/registry';

export type LlmsAction = {
	name: string;
	description: string;
	readOnly: boolean;
};

export function buildLlmsTxt(options: {
	siteUrl: string;
	siteName: string;
	description: string;
	actions: readonly LlmsAction[];
}): string {
	const siteUrl = options.siteUrl.replace(/\/$/, '');
	const lines = [
		`# ${options.siteName}`,
		'',
		`> ${options.description}`,
		'',
		'## When to use this',
		'- Read and create GPT prompts for the signed-in organization.',
		'- Call the same operations the web app uses, through MCP at /mcp.',
		'',
		'## Developer resources',
		`- [MCP endpoint](${siteUrl}/mcp): Streamable HTTP tools. Send a PropelAuth access token as a bearer, or the configured MCP API token. When the user belongs to more than one organization, send X-Org-Id.`,
		'',
		'## Tools',
		...options.actions.map((action) => {
			const access = action.readOnly ? 'read' : 'write';
			return `- \`${action.name}\` (${access}): ${action.description}`;
		}),
		'',
		'## Pages',
		`- [Home](${siteUrl}/): Welcome to Prompts with Friends`,
		`- [App](${siteUrl}/app): Signed-in prompt workspace`,
		`- [Setup](${siteUrl}/setup): Configuration guide`,
		'',
	];
	return lines.join('\n');
}

/** Generated from the action registry so /llms.txt stays aligned with /mcp. */
export function renderLlmsTxt(siteUrl: string): string {
	return buildLlmsTxt({
		siteUrl,
		siteName: websiteTitle,
		description: websiteDescription,
		actions,
	});
}
