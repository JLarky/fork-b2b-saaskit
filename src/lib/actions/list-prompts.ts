import { and, eq, or } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '../../db/db';
import { prompts } from '../../db/schema';
import { ActionError, defineAction } from './define-action';
import { type PromptPrivacyLevel, resolvePropelPublicUsers } from './prompt-shared';

export const listPrompts = defineAction({
	name: 'list-prompts',
	description:
		'List prompts in the active organization that the signed-in user is allowed to see (public, unlisted, team, and their own private prompts).',
	schema: z.object({}),
	readOnly: true,
	run: async (_input, ctx) => {
		if (!ctx.user) {
			throw new ActionError('UNAUTHORIZED', 'You need to sign in to list prompts.');
		}
		if (!ctx.orgId) {
			throw new ActionError('FORBIDDEN', 'Listing prompts requires an organization.');
		}
		const user = ctx.user;
		const orgId = ctx.orgId;
		const p = (level: PromptPrivacyLevel) => level;
		const promptsRes = await db
			.select()
			.from(prompts)
			.where(
				and(
					eq(prompts.orgId, orgId),
					or(
						eq(prompts.privacyLevel, p('public')),
						eq(prompts.privacyLevel, p('unlisted')),
						eq(prompts.privacyLevel, p('team')),
						and(eq(prompts.privacyLevel, p('private')), eq(prompts.userId, user.userId))
					)
				)
			);
		const userIds = new Set<string>();
		promptsRes.forEach((row) => userIds.add(row.userId));
		const users = await resolvePropelPublicUsers([...userIds]);
		if (users.kind === 'error') {
			console.error('Error fetching users', users.error);
		}
		return promptsRes.map((row) => ({
			promptId: row.promptId,
			userId: row.userId,
			title: row.title,
			isPublic: row.privacyLevel === 'public',
			_meta: {
				user: users.kind === 'ok' ? users.users[row.userId] : undefined,
			},
		}));
	},
});
