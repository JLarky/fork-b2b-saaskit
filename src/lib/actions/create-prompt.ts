import { nanoid } from 'nanoid';
import { z } from 'zod';

import { db } from '../../db/db';
import { promptLikes, prompts } from '../../db/schema';
import { trackEvent } from '../posthog';
import { ActionError, defineAction } from './define-action';
import { messageSchema, privacyLevelSchema, type PromptMessage } from './prompt-shared';

export const createPromptInput = z.object({
	title: z.string().optional().describe('Prompt title. An empty title is stored as "Untitled".'),
	description: z.string().optional().describe('Short description of the prompt.'),
	tags: z.array(z.string()).describe('Tags. Blank entries are dropped.'),
	template: z
		.array(messageSchema)
		.describe('Chat messages (system, user, assistant) that make up the prompt.'),
	privacyLevel: privacyLevelSchema.describe(
		'Who can read the prompt: public, unlisted, team, or private.'
	),
});

export const createPrompt = defineAction({
	name: 'create-prompt',
	description:
		'Create a prompt in the active organization for the signed-in user. The creator is recorded as the first like. Returns the new prompt id.',
	schema: createPromptInput,
	readOnly: false,
	run: async (input, ctx) => {
		if (!ctx.user) {
			throw new ActionError('UNAUTHORIZED', 'You need to sign in to create a prompt.');
		}
		if (!ctx.orgId) {
			throw new ActionError('FORBIDDEN', 'Creating a prompt requires an organization.');
		}
		const title = input.title || 'Untitled';
		const description = input.description || '';
		const tags = (input.tags || []).map((tag) => tag.trim()).filter((tag) => tag.length > 0);
		const template = input.template satisfies PromptMessage[];
		trackEvent(ctx.user, 'prompt_created');
		const promptId = nanoid();
		await db.insert(prompts).values({
			orgId: ctx.orgId,
			promptId,
			userId: ctx.user.userId,
			privacyLevel: input.privacyLevel,
			title,
			description,
			tags,
			template,
		});
		await db.insert(promptLikes).values({
			promptId,
			userId: ctx.user.userId,
		});
		return promptId;
	},
});
