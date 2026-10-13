import type { User } from '@propelauth/node';
import { z } from 'zod';

import { propelauth } from '../propelauth';
import { usersToPublicUserInfo } from '../publicUserInfo';

export const messageSchema = z.object({
	role: z.union([z.literal('user'), z.literal('assistant'), z.literal('system')]),
	content: z.string(),
});

export type PromptMessage = z.infer<typeof messageSchema>;

export const privacyLevelSchema = z.union([
	z.literal('public'),
	z.literal('team'),
	z.literal('unlisted'),
	z.literal('private'),
]);

export type PromptPrivacyLevel = z.infer<typeof privacyLevelSchema>;

export async function resolvePropelAuthUsers(userIds: string[]) {
	try {
		const users = await propelauth.fetchBatchUserMetadataByUserIds(userIds);
		return { kind: 'ok' as const, users };
	} catch (error) {
		return { kind: 'error' as const, error };
	}
}

export async function resolvePropelPublicUsers(userIds: string[]) {
	const result = await resolvePropelAuthUsers(userIds);
	if (result.kind === 'ok') {
		return { ...result, users: usersToPublicUserInfo(result.users) };
	}
	return result;
}

export function checkAccessToPrompt(
	prompt: { promptId: string; privacyLevel: PromptPrivacyLevel; userId: string; orgId: string },
	user: User | undefined
) {
	const privacyLevel = prompt.privacyLevel;

	// everyone can access public and unlisted prompts
	if (privacyLevel === 'public' || privacyLevel === 'unlisted') {
		return undefined;
	}
	// you need to be signed in to access private or team prompts
	if (!user) {
		return 'UNAUTHORIZED' as const;
	}
	// owners can access their own prompts
	if (prompt.userId === user.userId) {
		return undefined;
	}
	// no one else can access private prompts
	if (privacyLevel === 'private') {
		return 'FORBIDDEN' as const;
	}
	// you need to be in the same team to access team prompts
	if (privacyLevel === 'team') {
		const hasAccess = user.orgIdToOrgMemberInfo?.[prompt.orgId] !== undefined;
		if (hasAccess) {
			return undefined;
		}
	}
	return 'FORBIDDEN' as const;
}
