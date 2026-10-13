import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '../../db/db';
import { promptLikes, prompts } from '../../db/schema';
import { ActionError, defineAction } from './define-action';
import {
	checkAccessToPrompt,
	messageSchema,
	privacyLevelSchema,
	resolvePropelPublicUsers,
} from './prompt-shared';

export const getPrompt = defineAction({
	name: 'get-prompt',
	description:
		'Read one prompt by id, including its template, tags, like count, and share URLs. Public and unlisted prompts are readable without belonging to the organization. Private and team prompts use the same access checks as the app.',
	schema: z.object({
		promptId: z.string().describe('Id of the prompt to read.'),
	}),
	readOnly: true,
	run: async (input, ctx) => {
		const userId = ctx.user?.userId;
		const res = await db
			.select({
				promptId: prompts.promptId,
				userId: prompts.userId,
				orgId: prompts.orgId,
				privacyLevel: prompts.privacyLevel,
				title: prompts.title,
				description: prompts.description,
				tags: prompts.tags,
				template: prompts.template,
				createdAt: prompts.createdAt,
				updatedAt: prompts.updatedAt,
				likes: sql<number>`count(${promptLikes.userId})::int`,
				myLike: sql<boolean>`SUM(CASE WHEN ${promptLikes.userId} = (${
					userId || null
				})::text THEN 1 ELSE 0 END) > 0`,
			})
			.from(prompts)
			.leftJoin(promptLikes, eq(promptLikes.promptId, prompts.promptId))
			.groupBy(prompts.promptId)
			.where(eq(prompts.promptId, input.promptId));
		const originalPrompt = res[0];
		if (!originalPrompt) {
			throw new ActionError('NOT_FOUND', `Prompt ${input.promptId} not found`);
		}
		const validPrivacyLevel = privacyLevelSchema.safeParse(originalPrompt.privacyLevel);
		const prompt = {
			...originalPrompt,
			privacyLevel: validPrivacyLevel.success ? validPrivacyLevel.data : 'private',
		};
		const error = checkAccessToPrompt(prompt, ctx.user);
		if (error === 'UNAUTHORIZED') {
			throw new ActionError('UNAUTHORIZED', 'You need to sign in to access this prompt');
		}
		if (error === 'FORBIDDEN') {
			throw new ActionError('FORBIDDEN', "You don't have access to this prompt");
		}
		const users = await resolvePropelPublicUsers([prompt.userId]);
		const author = users.kind === 'ok' ? users.users[prompt.userId] : undefined;
		if (!author) {
			console.error('Error fetching users', users);
		}
		const { likes, template, tags, myLike, ...rest } = prompt;
		const validTemplate = z.array(messageSchema).safeParse(template);
		const validTags = z.array(z.string()).safeParse(tags);
		return {
			canEdit: prompt.userId === userId,
			likes,
			myLike,
			prompt: {
				...rest,
				template: validTemplate.success ? validTemplate.data : [],
				tags: validTags.success ? validTags.data : [],
			},
			author,
			shareUrl: ctx.origin + '/app/prompts/' + prompt.promptId,
			publicUrl: ctx.origin + '/prompts/' + prompt.promptId,
		};
	},
});
